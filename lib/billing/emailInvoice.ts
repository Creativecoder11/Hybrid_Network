import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { buildInvoicePdfData } from "@/lib/billing/invoiceData";
import { describePdfError, renderInvoicePdf } from "@/lib/pdf/render";
import { describeMailError, sendMail } from "@/lib/email/mailer";
import { invoiceEmailHtml } from "@/emails/templates";
import { formatCurrency, formatDate } from "@/lib/utils/format";

/** A failed invoice email. `message` is safe to show an admin; details go to the server log. */
export class InvoiceEmailError extends Error {}

/**
 * Emails an invoice to its customer with the PDF attached, stamps sentAt and
 * moves an unpaid invoice to Due (or Overdue past its due date).
 * Throws InvoiceEmailError naming the step that failed.
 */
export async function emailInvoiceToCustomer(invoiceId: string): Promise<{ delivered: boolean; to: string }> {
  await connectDB();
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new InvoiceEmailError("Invoice not found.");
  const customer = await User.findById(invoice.customer).select("name email").lean();
  if (!customer) throw new InvoiceEmailError("The invoice's customer no longer exists.");
  if (!customer.email) throw new InvoiceEmailError("The customer has no email address.");

  let pdfBuffer: Buffer;
  try {
    const pdfData = await buildInvoicePdfData(invoiceId);
    if (!pdfData) throw new Error("buildInvoicePdfData returned null");
    pdfBuffer = await renderInvoicePdf(pdfData);
  } catch (err) {
    console.error(`[invoices] PDF generation failed for ${invoice.invoiceNumber}:`, err);
    throw new InvoiceEmailError(describePdfError(err));
  }

  const portalUrl = `${process.env.CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal/bills/${invoiceId}`;
  let delivered: boolean;
  try {
    const mail = await sendMail({
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
    delivered = Boolean(mail.delivered);
  } catch (err) {
    console.error(`[invoices] email send failed for ${invoice.invoiceNumber} to ${customer.email}:`, err);
    throw new InvoiceEmailError(describeMailError(err));
  }

  invoice.pdfGeneratedAt = new Date();
  if (delivered) {
    invoice.sentAt = new Date();
    if (["DRAFT", "SENT", "DUE", "OVERDUE"].includes(invoice.status)) {
      invoice.status = invoice.dueDate.getTime() < Date.now() ? "OVERDUE" : "DUE";
    }
  }
  await invoice.save();

  return { delivered, to: customer.email };
}
