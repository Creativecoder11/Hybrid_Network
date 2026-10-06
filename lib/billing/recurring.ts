import "server-only";
import { connectDB } from "@/lib/db/connect";
import { RecurringInvoice } from "@/models/RecurringInvoice";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Settings } from "@/models/Settings";
import { ActivityLog } from "@/models/ActivityLog";
import { generateInvoiceNumber } from "@/lib/utils/ids";
import { emailInvoiceToCustomer } from "@/lib/billing/emailInvoice";
import { roundCurrency } from "@/lib/billing/money";
import { addDays, issueDateForCycle, periodMonthOf } from "@/lib/billing/recurringSchedule";

// Turns due recurring-invoice cycles into Invoices. Safe to call often and
// from several places at once (server timer, billing page loads, cron route):
// each cycle is claimed atomically on the schedule, and a unique index on
// Invoice(recurringInvoice, recurringCycle) backs that up.

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

let inFlight: Promise<{ generated: number }> | null = null;

export function runDueRecurringInvoices(now = new Date()): Promise<{ generated: number }> {
  // One run per process at a time; concurrent callers share it.
  if (!inFlight) {
    inFlight = runOnce(now).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runOnce(now: Date): Promise<{ generated: number }> {
  await connectDB();
  const due = await RecurringInvoice.find({ status: "ACTIVE", nextIssueDate: { $lte: now } })
    .select("_id")
    .lean();

  let generated = 0;
  for (const { _id } of due) {
    // Catch up every cycle that has fallen due (e.g. after downtime).
    for (;;) {
      const result = await generateNextCycle(_id.toString(), now);
      if (result === "generated") generated++;
      else break;
    }
  }
  return { generated };
}

async function generateNextCycle(scheduleId: string, now: Date): Promise<"generated" | "none"> {
  const schedule = await RecurringInvoice.findById(scheduleId).lean();
  if (!schedule || schedule.status !== "ACTIVE" || !schedule.nextIssueDate) return "none";
  if (schedule.nextIssueDate.getTime() > now.getTime()) return "none";

  const cycle = schedule.cyclesGenerated;
  if (cycle >= schedule.termMonths) {
    await RecurringInvoice.updateOne({ _id: scheduleId }, { $set: { status: "COMPLETED", nextIssueDate: null } });
    return "none";
  }

  const [customer, account] = await Promise.all([
    User.findById(schedule.customer).select("_id").lean(),
    CustomerAccount.findById(schedule.customerAccount).select("accountNumber").lean(),
  ]);
  if (!customer || !account) {
    await RecurringInvoice.updateOne(
      { _id: scheduleId },
      { $set: { status: "CANCELLED", nextIssueDate: null, lastError: "Customer or account no longer exists." } }
    );
    return "none";
  }

  const issueDate = issueDateForCycle(schedule, cycle);
  const isLast = cycle + 1 >= schedule.termMonths;
  const nextIssueDate = isLast ? null : issueDateForCycle(schedule, cycle + 1);

  // Claim the cycle. If another run already took it, cyclesGenerated has moved on.
  const claimed = await RecurringInvoice.findOneAndUpdate(
    { _id: scheduleId, status: "ACTIVE", cyclesGenerated: cycle },
    {
      $set: {
        cyclesGenerated: cycle + 1,
        nextIssueDate,
        status: isLast ? "COMPLETED" : "ACTIVE",
        lastIssuedAt: new Date(),
        lastError: "",
      },
    },
    { returnDocument: "after" }
  );
  if (!claimed) return "none";

  const settings = await Settings.findOne({ key: "GLOBAL" }).lean();
  const taxRate = settings?.taxRate ?? 0;
  const subtotal = roundCurrency(schedule.amount);
  const taxAmount = roundCurrency(subtotal * (taxRate / 100));
  const total = roundCurrency(subtotal + taxAmount);

  let invoiceId: string;
  let invoiceNumber: string;
  try {
    invoiceNumber = await generateInvoiceNumber();
    const invoice = await Invoice.create({
      invoiceNumber,
      customer: schedule.customer,
      customerAccount: schedule.customerAccount,
      accountNumber: account.accountNumber,
      subscription: schedule.subscription ?? null,
      recurringInvoice: schedule._id,
      recurringCycle: cycle,
      periodMonth: periodMonthOf(issueDate),
      issueDate,
      dueDate: addDays(issueDate, schedule.paymentTermsDays ?? 14),
      lineItems: [
        {
          description: `${schedule.description} (month ${cycle + 1} of ${schedule.termMonths})`,
          quantity: 1,
          unit: "month",
          unitPrice: subtotal,
          amount: subtotal,
        },
      ],
      subtotal,
      taxRate,
      taxLabel: settings?.taxLabel ?? "GST",
      taxAmount,
      total,
      currency: schedule.currency ?? "USD",
      status: "DRAFT",
      createdBy: schedule.createdBy ?? null,
    });
    invoiceId = invoice._id.toString();
  } catch (err) {
    // Already generated by a racing run: the claim above stands.
    if (isDuplicateKeyError(err)) return "generated";
    // Hand the cycle back so the next run retries it.
    await RecurringInvoice.updateOne(
      { _id: scheduleId, cyclesGenerated: cycle + 1 },
      {
        $set: {
          cyclesGenerated: cycle,
          nextIssueDate: issueDate,
          status: "ACTIVE",
          lastError: err instanceof Error ? err.message : "Invoice creation failed.",
        },
      }
    );
    console.error(`[recurring] failed to create invoice for schedule ${scheduleId} cycle ${cycle}:`, err);
    return "none";
  }

  await ActivityLog.create({
    actor: null,
    targetCustomer: schedule.customer,
    targetAccount: schedule.customerAccount,
    action: "INVOICE_CREATED",
    meta: {
      invoiceNumber,
      periodMonth: periodMonthOf(issueDate),
      total,
      accountNumber: account.accountNumber,
      recurring: true,
      cycle: cycle + 1,
      termMonths: schedule.termMonths,
    },
  });

  if (schedule.autoSend) {
    try {
      const mail = await emailInvoiceToCustomer(invoiceId);
      if (mail) {
        await ActivityLog.create({
          actor: null,
          targetCustomer: schedule.customer,
          targetAccount: schedule.customerAccount,
          action: "INVOICE_SENT",
          meta: { invoiceNumber, recurring: true, delivered: mail.delivered },
        });
      }
    } catch (err) {
      // The invoice exists as a Draft; the admin can send it from Billing.
      console.error(`[recurring] failed to email invoice ${invoiceNumber}:`, err);
      await RecurringInvoice.updateOne(
        { _id: scheduleId },
        { $set: { lastError: `Invoice ${invoiceNumber} was created but could not be emailed.` } }
      );
    }
  }

  return "generated";
}

/** Same as runDueRecurringInvoices but never throws — for page loads and timers. */
export async function runDueRecurringInvoicesSafely(): Promise<void> {
  try {
    const { generated } = await runDueRecurringInvoices();
    if (generated > 0) console.log(`[recurring] generated ${generated} invoice(s)`);
  } catch (err) {
    console.error("[recurring] run failed:", err);
  }
}

declare global {
  var _recurringInvoiceTimer: ReturnType<typeof setInterval> | undefined;
}

const TIMER_FIRST_RUN_MS = 60 * 1000;
const TIMER_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Checks for due recurring invoices shortly after boot and then hourly.
 * Hosts that put an idle app to sleep (Passenger) also get a run from the
 * billing pages loading, so a missed tick is caught up later.
 */
export function startRecurringInvoiceTimer(): void {
  if (process.env.DISABLE_RECURRING_INVOICE_TIMER === "true") return;
  if (globalThis._recurringInvoiceTimer) return;
  setTimeout(() => void runDueRecurringInvoicesSafely(), TIMER_FIRST_RUN_MS).unref();
  globalThis._recurringInvoiceTimer = setInterval(() => void runDueRecurringInvoicesSafely(), TIMER_INTERVAL_MS);
  globalThis._recurringInvoiceTimer.unref();
}
