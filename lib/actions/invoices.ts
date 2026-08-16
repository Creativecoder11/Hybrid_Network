"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { UsageRecord } from "@/models/UsageRecord";
import { Settings } from "@/models/Settings";
import { ActivityLog } from "@/models/ActivityLog";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { generateInvoiceNumber } from "@/lib/utils/ids";
import { computeInvoiceLineItems } from "@/lib/billing/calc";
import { roundCurrency } from "@/lib/billing/money";
import { buildInvoicePdfData } from "@/lib/billing/invoiceData";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { sendMail } from "@/lib/email/mailer";
import { invoiceEmailHtml, invoiceReminderEmailHtml } from "@/emails/templates";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { createInvoiceSchema, markPaidSchema, updateInvoiceSchema } from "@/lib/validations/invoice";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createInvoiceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const extraDescriptions = formData.getAll("extraDescription");
  const extraQuantities = formData.getAll("extraQuantity");
  const extraUnits = formData.getAll("extraUnit");
  const extraUnitPrices = formData.getAll("extraUnitPrice");
  const extraLineItems = extraDescriptions
    .map((desc, i) => ({
      description: String(desc ?? "").trim(),
      quantity: Number(extraQuantities[i]) || 0,
      unit: String(extraUnits[i] ?? "").trim(),
      unitPrice: Number(extraUnitPrices[i]) || 0,
    }))
    .filter((li) => li.description);

  const parsed = createInvoiceSchema.safeParse({
    customerId: str(formData, "customerId"),
    subscriptionId: str(formData, "subscriptionId") || null,
    periodMonth: str(formData, "periodMonth"),
    dueDate: str(formData, "dueDate"),
    amount: str(formData, "amount") || undefined,
    status: str(formData, "status") || undefined,
    extraLineItems,
    taxRate: str(formData, "taxRate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();

  const customer = await User.findOne({ _id: parsed.data.customerId, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };

  const subscription = await Subscription.findOne({
    customer: customer._id,
    status: "ACTIVE",
  }).sort({ createdAt: -1 });
  if (!subscription) return { error: "This customer has no active subscription to bill." };

  const plan = await ServicePlan.findById(subscription.plan);
  if (!plan) return { error: "The customer's plan could not be found." };

  const usage = await UsageRecord.findOne({ customer: customer._id, periodMonth: parsed.data.periodMonth });

  const { lineItems, subtotal } =
    parsed.data.amount !== undefined
      ? {
          lineItems: [
            {
              description: `${plan.name} — Monthly Subscription`,
              quantity: 1,
              unit: "month",
              unitPrice: parsed.data.amount,
              amount: parsed.data.amount,
            },
          ],
          subtotal: parsed.data.amount,
        }
      : computeInvoiceLineItems({
          planName: plan.name,
          monthlyPrice: plan.monthlyPrice,
          dataAllowanceGB: plan.dataAllowanceGB ?? null,
          voiceMinutes: plan.voiceMinutes ?? null,
          overageRatePerGB: plan.overageRatePerGB ?? 0,
          overageRatePerMin: plan.overageRatePerMin ?? 0,
          usedDataBytes: usage?.volumeDataBytes ?? 0,
          usedVoiceMin: usage?.volumeMin ?? 0,
          extraLineItems: parsed.data.extraLineItems,
        });

  const settings = await Settings.findOne({ key: "GLOBAL" });
  const taxRate = parsed.data.taxRate ?? settings?.taxRate ?? 0;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const initialStatus = parsed.data.status ?? "DRAFT";
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await Invoice.create({
    invoiceNumber,
    customer: customer._id,
    subscription: subscription._id,
    periodMonth: parsed.data.periodMonth,
    issueDate: new Date(),
    dueDate: new Date(parsed.data.dueDate),
    lineItems,
    subtotal,
    taxRate,
    taxLabel: settings?.taxLabel ?? "GST",
    taxAmount,
    total,
    currency: plan.currency ?? "USD",
    status: initialStatus,
    paidDate: initialStatus === "PAID" ? new Date() : null,
    paymentMethod: initialStatus === "PAID" ? "Manual Entry" : "",
    createdBy: admin.id,
  });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "INVOICE_CREATED",
    meta: { invoiceNumber, periodMonth: parsed.data.periodMonth, total },
  });

  revalidatePath("/admin/billing");
  revalidatePath(`/admin/customers/${customer._id.toString()}`);
  redirect(`/admin/billing/${invoice._id.toString()}`);
}

export async function sendInvoiceAction(invoiceId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return { error: "Invoice not found." };
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    return { error: `This invoice is already ${invoice.status.toLowerCase()}.` };
  }

  const customer = await User.findById(invoice.customer);
  if (!customer) return { error: "Customer not found." };

  const pdfData = await buildInvoicePdfData(invoiceId);
  if (!pdfData) return { error: "Could not build the invoice PDF." };

  const pdfBuffer = await renderInvoicePdf(pdfData);
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/bills/${invoiceId}`;

  await sendMail({
    to: customer.email,
    subject: `Invoice ${invoice.invoiceNumber} from Hybrid Networks`,
    html: invoiceEmailHtml({
      name: customer.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: formatCurrency(invoice.total, invoice.currency),
      dueDate: formatDate(invoice.dueDate),
      portalUrl,
    }),
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  invoice.status = invoice.dueDate.getTime() < Date.now() ? "OVERDUE" : "DUE";
  invoice.sentAt = new Date();
  invoice.pdfGeneratedAt = new Date();
  await invoice.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "INVOICE_SENT",
    meta: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath("/admin/billing");
  revalidatePath(`/admin/billing/${invoiceId}`);
  return { success: `Invoice sent to ${customer.email}.` };
}

export async function markPaidAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = markPaidSchema.safeParse({
    invoiceId: str(formData, "invoiceId"),
    paymentMethod: str(formData, "paymentMethod"),
    paidDate: str(formData, "paidDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const invoice = await Invoice.findById(parsed.data.invoiceId);
  if (!invoice) return { error: "Invoice not found." };

  invoice.status = "PAID";
  invoice.paidDate = new Date(parsed.data.paidDate);
  invoice.paymentMethod = parsed.data.paymentMethod;
  await invoice.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: invoice.customer,
    action: "INVOICE_PAID",
    meta: { invoiceNumber: invoice.invoiceNumber, paymentMethod: parsed.data.paymentMethod },
  });

  revalidatePath("/admin/billing");
  revalidatePath(`/admin/billing/${parsed.data.invoiceId}`);
  return { success: "Invoice marked as paid." };
}

export async function updateInvoiceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = updateInvoiceSchema.safeParse({
    invoiceId: str(formData, "invoiceId"),
    periodMonth: str(formData, "periodMonth"),
    dueDate: str(formData, "dueDate"),
    amount: str(formData, "amount"),
    status: str(formData, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const invoice = await Invoice.findById(parsed.data.invoiceId);
  if (!invoice) return { error: "Invoice not found." };
  if (invoice.status === "PAID") {
    return { error: "A paid invoice can't be edited. Cancel it and create a new bill instead." };
  }

  const settings = await Settings.findOne({ key: "GLOBAL" });
  const taxRate = settings?.taxRate ?? invoice.taxRate ?? 0;
  const subtotal = parsed.data.amount;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const description = invoice.lineItems[0]?.description ?? "Monthly Subscription";
  invoice.set("lineItems", [
    { description, quantity: 1, unit: "month", unitPrice: subtotal, amount: subtotal },
  ]);
  invoice.subtotal = subtotal;
  invoice.taxRate = taxRate;
  invoice.taxAmount = taxAmount;
  invoice.total = total;
  invoice.periodMonth = parsed.data.periodMonth;
  invoice.dueDate = new Date(parsed.data.dueDate);

  // We already returned above when the invoice was PAID, so reaching here
  // means this is the transition INTO paid (not a no-op re-save of PAID).
  if (parsed.data.status === "PAID") {
    invoice.paidDate = new Date();
    if (!invoice.paymentMethod) invoice.paymentMethod = "Manual Entry";
  } else {
    invoice.paidDate = null;
  }
  invoice.status = parsed.data.status;

  await invoice.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: invoice.customer,
    action: "INVOICE_UPDATED",
    meta: { invoiceNumber: invoice.invoiceNumber, total },
  });

  revalidatePath("/admin/billing");
  revalidatePath(`/admin/billing/${parsed.data.invoiceId}`);
  return { success: "Bill updated." };
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return { error: "Invoice not found." };

  invoice.deletedAt = new Date();
  await invoice.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: invoice.customer,
    action: "INVOICE_DELETED",
    meta: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath("/admin/billing");
  return { success: "Bill moved to trash." };
}

export async function restoreInvoiceAction(invoiceId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const invoice = await Invoice.findOne({ _id: invoiceId, deletedAt: { $ne: null } });
  if (!invoice) return { error: "Invoice not found in trash." };

  invoice.deletedAt = null;
  await invoice.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: invoice.customer,
    action: "INVOICE_RESTORED",
    meta: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath("/admin/billing");
  return { success: "Bill restored." };
}

export async function purgeInvoiceAction(invoiceId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const invoice = await Invoice.findOne({ _id: invoiceId, deletedAt: { $ne: null } });
  if (!invoice) return { error: "Invoice not found in trash." };

  await Invoice.deleteOne({ _id: invoiceId });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: invoice.customer,
    action: "INVOICE_PURGED",
    meta: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath("/admin/billing");
  return { success: "Bill permanently deleted." };
}

export async function cancelInvoiceAction(invoiceId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return { error: "Invoice not found." };
  if (invoice.status === "PAID") return { error: "A paid invoice can't be cancelled." };

  invoice.status = "CANCELLED";
  await invoice.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: invoice.customer,
    action: "INVOICE_CANCELLED",
    meta: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath("/admin/billing");
  revalidatePath(`/admin/billing/${invoiceId}`);
  return { success: "Invoice cancelled." };
}

export async function bulkSendRemindersAction(invoiceIds: string[]): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const invoices = await Invoice.find({
    _id: { $in: invoiceIds },
    status: { $in: ["DUE", "OVERDUE", "SENT"] },
  });

  let sent = 0;
  for (const invoice of invoices) {
    const customer = await User.findById(invoice.customer);
    if (!customer) continue;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/bills/${invoice._id.toString()}`;
    await sendMail({
      to: customer.email,
      subject: `Payment reminder: Invoice ${invoice.invoiceNumber}`,
      html: invoiceReminderEmailHtml({
        name: customer.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: formatCurrency(invoice.total, invoice.currency),
        dueDate: formatDate(invoice.dueDate),
        portalUrl,
      }),
    });
    sent++;
  }

  await ActivityLog.create({
    actor: admin.id,
    action: "INVOICE_SENT",
    meta: { event: "BULK_REMINDER", count: sent },
  });

  revalidatePath("/admin/billing");
  return { success: `Sent ${sent} reminder${sent === 1 ? "" : "s"}.` };
}

export async function bulkMarkPaidAction(
  invoiceIds: string[],
  paymentMethod: string
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!paymentMethod) return { error: "Choose a payment method." };

  await connectDB();
  const result = await Invoice.updateMany(
    { _id: { $in: invoiceIds }, status: { $ne: "PAID" } },
    { $set: { status: "PAID", paidDate: new Date(), paymentMethod } }
  );

  await ActivityLog.create({
    actor: admin.id,
    action: "INVOICE_PAID",
    meta: { event: "BULK_MARK_PAID", count: result.modifiedCount },
  });

  revalidatePath("/admin/billing");
  return { success: `Marked ${result.modifiedCount} invoice${result.modifiedCount === 1 ? "" : "s"} as paid.` };
}

/**
 * Generates one invoice per customer from selected, priced CDR charge
 * records. Only MATCHED, not-yet-invoiced records are eligible; records with
 * no matched customer are skipped (assign a customer to them first). Each
 * line item keeps the wholesale/retail pricing snapshot for audit purposes.
 */
export async function generateInvoicesFromChargesAction(
  chargeRecordIds: string[],
  periodMonth: string,
  dueDate: string
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  if (chargeRecordIds.length === 0) return { error: "Select at least one charge record." };
  if (!/^\d{6}$/.test(periodMonth)) return { error: "Invalid billing period." };
  if (!dueDate) return { error: "Due date is required." };

  await connectDB();

  const records = await CdrChargeRecord.find({
    _id: { $in: chargeRecordIds },
    status: "MATCHED",
    invoice: null,
  });
  if (records.length === 0) {
    return {
      error: "None of the selected records are eligible to invoice (already invoiced, unmatched, or invalid).",
    };
  }

  const byCustomer = new Map<string, typeof records>();
  let skippedNoCustomer = 0;
  for (const r of records) {
    if (!r.customer) {
      skippedNoCustomer++;
      continue;
    }
    const key = r.customer.toString();
    const list = byCustomer.get(key) ?? [];
    list.push(r);
    byCustomer.set(key, list);
  }
  if (byCustomer.size === 0) {
    return { error: "None of the selected records have a matched customer yet. Assign a customer first." };
  }

  const settings = await Settings.findOne({ key: "GLOBAL" });
  const taxRate = settings?.taxRate ?? 0;

  let created = 0;
  for (const [customerId, group] of byCustomer) {
    const customer = await User.findById(customerId);
    if (!customer) continue;

    const lineItems = group.map((r) => ({
      description: r.description || `CDR Charge — ${r.identifier}`,
      quantity: 1,
      unit: "",
      unitPrice: r.retailAmount,
      amount: r.retailAmount,
      cdrChargeRecord: r._id,
      cdrIdentifier: r.identifier,
      wholesaleAmount: r.wholesaleAmount,
      retailPlanName: r.retailPlanName,
      pricingMethod: r.pricingMethodUsed ?? "",
      markupPercent: r.markupPercentUsed,
      fixedPrice: r.fixedPriceUsed,
    }));

    const subtotal = roundCurrency(lineItems.reduce((sum, li) => sum + li.amount, 0));
    const taxAmount = roundCurrency(subtotal * (taxRate / 100));
    const total = roundCurrency(subtotal + taxAmount);
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      customer: customer._id,
      periodMonth,
      issueDate: new Date(),
      dueDate: new Date(dueDate),
      lineItems,
      subtotal,
      taxRate,
      taxLabel: settings?.taxLabel ?? "GST",
      taxAmount,
      total,
      currency: group[0].currency || "USD",
      status: "DRAFT",
      createdBy: admin.id,
    });

    await CdrChargeRecord.updateMany(
      { _id: { $in: group.map((r) => r._id) } },
      { $set: { invoice: invoice._id } }
    );

    await ActivityLog.create({
      actor: admin.id,
      targetCustomer: customer._id,
      action: "CDR_CHARGES_INVOICED",
      meta: { invoiceNumber, chargeCount: group.length, total },
    });

    created++;
  }

  revalidatePath("/admin/billing");
  revalidatePath("/admin/billing/cdr-import");

  if (created === 0) return { error: "No invoices could be created." };
  const skippedNote =
    skippedNoCustomer > 0 ? ` ${skippedNoCustomer} record(s) skipped (no matched customer).` : "";
  return { success: `Created ${created} invoice${created === 1 ? "" : "s"}.${skippedNote}` };
}
