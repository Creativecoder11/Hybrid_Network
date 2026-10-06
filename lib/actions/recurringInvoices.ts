"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { RecurringInvoice } from "@/models/RecurringInvoice";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { roundCurrency } from "@/lib/billing/money";
import { runDueRecurringInvoices } from "@/lib/billing/recurring";
import { nextBillingDateOnOrAfter, parseDateOnly } from "@/lib/billing/recurringSchedule";
import { createRecurringInvoiceSchema } from "@/lib/validations/recurringInvoice";
import type { ActionState } from "@/lib/actions/customers";

// A first invoice date further back than this would back-bill (and email) a
// pile of invoices at once — almost always a typo in the year.
const MAX_BACKDATE_DAYS = 31;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateBilling(customerId?: string) {
  revalidatePath("/admin/billing");
  revalidatePath("/admin/billing/recurring");
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
}

export async function createRecurringInvoiceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = createRecurringInvoiceSchema.safeParse({
    customerId: str(formData, "customerId"),
    customerAccountId: str(formData, "customerAccountId"),
    description: str(formData, "description"),
    amount: str(formData, "amount"),
    termMonths: str(formData, "termMonths"),
    startDate: str(formData, "startDate"),
    paymentTermsDays: str(formData, "paymentTermsDays") || undefined,
    autoSend: formData.get("autoSend") !== "false",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;

  const startDate = parseDateOnly(data.startDate);
  if (!startDate) return { error: "Choose a valid first invoice date." };
  const earliest = Date.now() - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000;
  if (startDate.getTime() < earliest) {
    return { error: `The first invoice date can't be more than ${MAX_BACKDATE_DAYS} days in the past.` };
  }

  if (!isValidObjectId(data.customerId) || !isValidObjectId(data.customerAccountId)) {
    return { error: "Customer not found." };
  }

  await connectDB();
  const customer = await User.findOne({ _id: data.customerId, ...CUSTOMER_PROFILE_FILTER }).select("name").lean();
  if (!customer) return { error: "Customer not found." };
  const account = await CustomerAccount.findOne({ _id: data.customerAccountId, customer: customer._id })
    .select("accountNumber")
    .lean();
  if (!account) return { error: "That account doesn't belong to this customer." };

  const subscription = await Subscription.findOne({ customerAccount: account._id, status: "ACTIVE" })
    .sort({ createdAt: -1 })
    .select("plan")
    .lean();
  const plan = subscription ? await ServicePlan.findById(subscription.plan).select("currency").lean() : null;

  const schedule = await RecurringInvoice.create({
    customer: customer._id,
    customerAccount: account._id,
    accountNumber: account.accountNumber,
    subscription: subscription?._id ?? null,
    description: data.description,
    amount: roundCurrency(data.amount),
    currency: plan?.currency ?? "USD",
    termMonths: data.termMonths,
    billingDay: startDate.getUTCDate(),
    paymentTermsDays: data.paymentTermsDays,
    autoSend: data.autoSend,
    startDate,
    anchorDate: startDate,
    anchorCycle: 0,
    cyclesGenerated: 0,
    nextIssueDate: startDate,
    status: "ACTIVE",
    createdBy: admin.id,
  });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    targetAccount: account._id,
    action: "RECURRING_INVOICE_CREATED",
    meta: {
      accountNumber: account.accountNumber,
      amount: schedule.amount,
      termMonths: data.termMonths,
      startDate: data.startDate,
    },
  });

  // A schedule starting today issues its first invoice straight away.
  const { generated } = await runDueRecurringInvoices();

  revalidateBilling(customer._id.toString());
  return {
    success:
      generated > 0
        ? `Recurring invoice set up for ${data.termMonths} month(s). The first invoice has been issued.`
        : `Recurring invoice set up for ${data.termMonths} month(s).`,
  };
}

async function loadSchedule(id: string) {
  if (!isValidObjectId(id)) return null;
  await connectDB();
  return RecurringInvoice.findById(id);
}

export async function pauseRecurringInvoiceAction(id: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const schedule = await loadSchedule(id);
  if (!schedule) return { error: "Recurring invoice not found." };
  if (schedule.status !== "ACTIVE") return { error: "Only an active schedule can be paused." };

  schedule.status = "PAUSED";
  schedule.nextIssueDate = null;
  await schedule.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: schedule.customer,
    targetAccount: schedule.customerAccount,
    action: "RECURRING_INVOICE_PAUSED",
    meta: { accountNumber: schedule.accountNumber, cyclesGenerated: schedule.cyclesGenerated },
  });

  revalidateBilling(schedule.customer.toString());
  return { success: "Recurring invoice paused. No invoices are issued while it's paused." };
}

export async function resumeRecurringInvoiceAction(id: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const schedule = await loadSchedule(id);
  if (!schedule) return { error: "Recurring invoice not found." };
  if (schedule.status !== "PAUSED") return { error: "Only a paused schedule can be resumed." };

  // Paused months aren't back-billed: the remaining invoices continue from the
  // next billing day, so the term still issues termMonths invoices in total.
  const next = nextBillingDateOnOrAfter(new Date(), schedule.billingDay);
  schedule.anchorDate = next;
  schedule.anchorCycle = schedule.cyclesGenerated;
  schedule.nextIssueDate = next;
  schedule.status = "ACTIVE";
  await schedule.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: schedule.customer,
    targetAccount: schedule.customerAccount,
    action: "RECURRING_INVOICE_RESUMED",
    meta: { accountNumber: schedule.accountNumber, nextIssueDate: next.toISOString() },
  });

  await runDueRecurringInvoices();
  revalidateBilling(schedule.customer.toString());
  return { success: "Recurring invoice resumed." };
}

export async function cancelRecurringInvoiceAction(id: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const schedule = await loadSchedule(id);
  if (!schedule) return { error: "Recurring invoice not found." };
  if (schedule.status === "CANCELLED" || schedule.status === "COMPLETED") {
    return { error: `This schedule is already ${schedule.status.toLowerCase()}.` };
  }

  schedule.status = "CANCELLED";
  schedule.nextIssueDate = null;
  await schedule.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: schedule.customer,
    targetAccount: schedule.customerAccount,
    action: "RECURRING_INVOICE_CANCELLED",
    meta: { accountNumber: schedule.accountNumber, cyclesGenerated: schedule.cyclesGenerated },
  });

  revalidateBilling(schedule.customer.toString());
  return { success: "Recurring invoice cancelled. Invoices already issued are kept." };
}
