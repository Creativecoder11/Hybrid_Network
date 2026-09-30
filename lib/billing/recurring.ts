import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { RecurringInvoice } from "@/models/RecurringInvoice";
import { Subscription } from "@/models/Subscription";
import { ActivityLog } from "@/models/ActivityLog";
import { generateInvoiceNumber } from "@/lib/utils/ids";
import { roundCurrency } from "@/lib/billing/money";
import { addDaysUtc, occurrenceDate, periodMonthOf } from "@/lib/billing/schedule";

// Generates the DRAFT invoices that recurring schedules have fallen due for.
// Safe to run any number of times (daily cron, the admin "Generate now"
// button, or both at once): each schedule month is created at most once,
// enforced by the unique (recurringInvoice, recurringSequence) index on
// Invoice. Months missed while nothing ran are caught up, one invoice each.

export type RecurringRunResult = {
  created: { id: string; invoiceNumber: string; scheduleId: string; sequence: number }[];
  failed: { scheduleId: string; error: string }[];
};

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export async function generateDueRecurringInvoices(options?: {
  now?: Date;
  actorId?: string | null;
  scheduleId?: string;
}): Promise<RecurringRunResult> {
  await connectDB();
  const now = options?.now ?? new Date();
  const result: RecurringRunResult = { created: [], failed: [] };

  const filter: Record<string, unknown> = { status: "ACTIVE", nextInvoiceDate: { $ne: null, $lte: now } };
  if (options?.scheduleId) filter._id = options.scheduleId;
  const schedules = await RecurringInvoice.find(filter);

  for (const schedule of schedules) {
    const scheduleId = schedule._id.toString();
    try {
      const subscription = await Subscription.findOne({ customerAccount: schedule.customerAccount, status: "ACTIVE" })
        .sort({ createdAt: -1 })
        .select("_id")
        .lean();
      let generated = schedule.invoicesGenerated;

      while (generated < schedule.durationMonths) {
        const sequence = generated + 1;
        const issueDate = occurrenceDate(schedule.startDate, sequence - 1);
        if (issueDate.getTime() > now.getTime()) break;

        // Raw collection lookup so trashed invoices count too (the model's
        // soft-delete hook would hide them).
        const existing = await Invoice.collection.findOne({ recurringInvoice: schedule._id, recurringSequence: sequence });
        if (!existing) {
          const taxAmount = roundCurrency(schedule.subtotal * (schedule.taxRate / 100));
          try {
            const invoice = await Invoice.create({
              invoiceNumber: await generateInvoiceNumber(),
              customer: schedule.customer,
              customerAccount: schedule.customerAccount,
              accountNumber: schedule.accountNumber,
              subscription: subscription?._id ?? null,
              periodMonth: periodMonthOf(issueDate),
              issueDate,
              dueDate: addDaysUtc(issueDate, schedule.dueDays),
              lineItems: schedule.lineItems,
              subtotal: schedule.subtotal,
              taxRate: schedule.taxRate,
              taxLabel: schedule.taxLabel,
              taxAmount,
              total: roundCurrency(schedule.subtotal + taxAmount),
              currency: schedule.currency,
              status: "DRAFT",
              createdBy: options?.actorId ?? schedule.createdBy ?? null,
              recurringInvoice: schedule._id,
              recurringSequence: sequence,
            });
            result.created.push({ id: invoice._id.toString(), invoiceNumber: invoice.invoiceNumber, scheduleId, sequence });
            await ActivityLog.create({
              actor: options?.actorId ?? null,
              targetCustomer: schedule.customer,
              targetAccount: schedule.customerAccount,
              action: "INVOICE_CREATED",
              meta: {
                invoiceNumber: invoice.invoiceNumber,
                recurringInvoice: scheduleId,
                sequence,
                of: schedule.durationMonths,
              },
            });
          } catch (err) {
            // Another run created this month first — that's the outcome we want.
            if (!isDuplicateKey(err)) throw err;
          }
        }
        generated = sequence;
      }

      const done = generated >= schedule.durationMonths;
      // Conditional update: a schedule paused/cancelled mid-run keeps that status.
      await RecurringInvoice.updateOne(
        { _id: schedule._id, status: "ACTIVE" },
        {
          $max: { invoicesGenerated: generated },
          $set: {
            nextInvoiceDate: done ? null : occurrenceDate(schedule.startDate, generated),
            ...(done ? { status: "COMPLETED" } : {}),
          },
        }
      );
    } catch (err) {
      console.error(`[recurring] schedule ${scheduleId} failed:`, err);
      result.failed.push({ scheduleId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}
