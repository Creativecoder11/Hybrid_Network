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
import { getAuthorizedUser } from "@/lib/auth/dal";
import { generateInvoiceNumber } from "@/lib/utils/ids";
import { computeInvoiceLineItems } from "@/lib/billing/calc";
import { buildInvoicePdfData } from "@/lib/billing/invoiceData";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { sendMail } from "@/lib/email/mailer";
import { invoiceEmailHtml, invoiceReminderEmailHtml } from "@/emails/templates";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { createInvoiceSchema, markPaidSchema } from "@/lib/validations/invoice";
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

  const { lineItems, subtotal } = computeInvoiceLineItems({
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
    currency: plan.currency ?? "MYR",
    status: "DRAFT",
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
