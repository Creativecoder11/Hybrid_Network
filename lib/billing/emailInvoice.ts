import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { buildInvoicePdfData } from "@/lib/billing/invoiceData";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { sendMail } from "@/lib/email/mailer";
import { invoiceEmailHtml } from "@/emails/templates";
import { formatCurrency, formatDate } from "@/lib/utils/format";

/**
 * Emails an invoice to its customer with the PDF attached, stamps sentAt and
 * moves a Draft to Due (or Overdue). Returns null when the invoice, customer
 * or PDF data can't be found.
 */
export async function emailInvoiceToCustomer(invoiceId: string): Promise<{ delivered: boolean } | null> {
  await connectDB();
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;
  const customer = await User.findById(invoice.customer).select("name email").lean();
  if (!customer) return null;

  const pdfData = await buildInvoicePdfData(invoiceId);
  if (!pdfData) return null;
  const pdfBuffer = await renderInvoicePdf(pdfData);
  const portalUrl = `${process.env.CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal/bills/${invoiceId}`;

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

  invoice.sentAt = new Date();
  invoice.pdfGeneratedAt = new Date();
  if (invoice.status === "DRAFT") {
    invoice.status = invoice.dueDate.getTime() < Date.now() ? "OVERDUE" : "DUE";
  }
  await invoice.save();

  return { delivered: Boolean(mail.delivered) };
}
