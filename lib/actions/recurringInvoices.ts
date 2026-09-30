"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { RecurringInvoice } from "@/models/RecurringInvoice";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { Settings } from "@/models/Settings";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { roundCurrency } from "@/lib/billing/money";
import { parseDateOnly } from "@/lib/billing/schedule";
import { generateDueRecurringInvoices } from "@/lib/billing/recurring";
import { createRecurringInvoiceSchema } from "@/lib/validations/recurringInvoice";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number | undefined {
  const v = str(formData, key);
  return v === "" ? undefined : Number(v);
}

function revalidateBilling() {
  revalidatePath("/admin/billing");
  revalidatePath("/admin/billing/recurring");
}

export async function createRecurringInvoiceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const descriptions = formData.getAll("lineDescription");
  const quantities = formData.getAll("lineQuantity");
  const units = formData.getAll("lineUnit");
  const unitPrices = formData.getAll("lineUnitPrice");
  const lineItems = descriptions
    .map((d, i) => ({
      description: String(d ?? "").trim(),
      quantity: Number(quantities[i]),
      unit: String(units[i] ?? "").trim(),
      unitPrice: Number(unitPrices[i]),
    }))
    .filter((li) => li.description || li.unitPrice);

  const parsed = createRecurringInvoiceSchema.safeParse({
    customerAccountId: str(formData, "customerAccountId"),
    startDate: str(formData, "startDate"),
    durationMonths: num(formData, "durationMonths"),
    dueDays: num(formData, "dueDays"),
    taxRate: num(formData, "taxRate"),
    lineItems,
    notes: str(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;

  await connectDB();
  const account = await CustomerAccount.findById(data.customerAccountId).select("customer accountNumber").lean();
  if (!account) return { error: "Customer Account not found." };

  const [settings, subscription] = await Promise.all([
    Settings.findOne({ key: "GLOBAL" }).lean(),
    Subscription.findOne({ customerAccount: account._id, status: "ACTIVE" }).sort({ createdAt: -1 }).select("plan").lean(),
  ]);
  const plan = subscription ? await ServicePlan.findById(subscription.plan).select("currency").lean() : null;

  const items = data.lineItems.map((li) => ({ ...li, amount: roundCurrency(li.quantity * li.unitPrice) }));
  const subtotal = roundCurrency(items.reduce((sum, li) => sum + li.amount, 0));
  const startDate = parseDateOnly(data.startDate) as Date;

  const schedule = await RecurringInvoice.create({
    customer: account.customer,
    customerAccount: account._id,
    accountNumber: account.accountNumber,
    lineItems: items,
    subtotal,
    taxRate: data.taxRate ?? settings?.taxRate ?? 0,
    taxLabel: settings?.taxLabel ?? "GST",
    currency: plan?.currency ?? settings?.currency ?? "USD",
    startDate,
    durationMonths: data.durationMonths,
    dueDays: data.dueDays,
    nextInvoiceDate: startDate,
    status: "ACTIVE",
    notes: data.notes,
    createdBy: admin.id,
  });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: account.customer,
    targetAccount: account._id,
    action: "RECURRING_INVOICE_CREATED",
    meta: { recurringInvoice: schedule._id.toString(), durationMonths: data.durationMonths, startDate: data.startDate, subtotal },
  });

  // A start date of today or earlier is already due: create that draft now
  // rather than waiting for the next scheduled run.
  const run = await generateDueRecurringInvoices({ scheduleId: schedule._id.toString(), actorId: admin.id });

  revalidateBilling();
  return {
    success:
      run.created.length > 0
        ? `Recurring invoice created. Draft ${run.created.map((c) => c.invoiceNumber).join(", ")} is ready to review.`
        : "Recurring invoice created. The first draft will be generated on the start date.",
  };
}

const TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["PAUSED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
};

export async function setRecurringInvoiceStatusAction(
  scheduleId: string,
  status: "ACTIVE" | "PAUSED" | "CANCELLED"
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!isValidObjectId(scheduleId)) return { error: "Recurring invoice not found." };

  await connectDB();
  const schedule = await RecurringInvoice.findById(scheduleId);
  if (!schedule) return { error: "Recurring invoice not found." };
  if (!TRANSITIONS[schedule.status]?.includes(status)) {
    return { error: `A ${schedule.status.toLowerCase()} recurring invoice can't be changed to ${status.toLowerCase()}.` };
  }

  const from = schedule.status;
  schedule.status = status;
  // Invoices already generated are left as they are.
  if (status === "CANCELLED") schedule.nextInvoiceDate = null;
  await schedule.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: schedule.customer,
    targetAccount: schedule.customerAccount,
    action: "RECURRING_INVOICE_STATUS_CHANGED",
    meta: { recurringInvoice: scheduleId, from, to: status },
  });

  revalidateBilling();
  const label = { ACTIVE: "resumed", PAUSED: "paused", CANCELLED: "cancelled" }[status];
  return { success: `Recurring invoice ${label}.` };
}

/** Admin "Generate due invoices now": the same run the daily cron performs. */
export async function generateRecurringInvoicesNowAction(): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const run = await generateDueRecurringInvoices({ actorId: admin.id });
  revalidateBilling();
  if (run.failed.length > 0) {
    return { error: `${run.created.length} draft(s) created, but ${run.failed.length} schedule(s) failed. Check the server log.` };
  }
  return {
    success:
      run.created.length > 0
        ? `${run.created.length} draft invoice(s) created: ${run.created.map((c) => c.invoiceNumber).join(", ")}.`
        : "No recurring invoices are due right now.",
  };
}
