import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { listAuthorizedAccounts } from "@/lib/accounts/access";
import { CUSTOMER_VISIBLE_STATUSES } from "@/lib/portal/billing";
import { buildInvoicePdfData } from "@/lib/billing/invoiceData";
import { renderInvoicePdf } from "@/lib/pdf/render";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthorizedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
  }
  await connectDB();

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
  }

  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN";
  if (!isAdmin) {
    // Customer: the invoice must belong to one of their authorized accounts
    // (legacy invoices without an account fall back to the profile check)
    // and must have been issued — drafts are internal.
    const accounts = await listAuthorizedAccounts(user);
    const ownsAccount = invoice.customerAccount
      ? accounts.some((a) => a.id === invoice.customerAccount?.toString())
      : user.accountAccessAll && invoice.customer.toString() === user.customerProfileId;
    if (!ownsAccount || !CUSTOMER_VISIBLE_STATUSES.includes(invoice.status)) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }
  }

  let pdfBuffer: Buffer;
  try {
    const pdfData = await buildInvoicePdfData(id);
    if (!pdfData) {
      console.error(`[invoice-pdf] could not build PDF data for invoice ${id} (customer record missing?)`);
      return NextResponse.json({ success: false, error: "Could not build the invoice." }, { status: 500 });
    }
    pdfBuffer = await renderInvoicePdf(pdfData);
  } catch (err) {
    console.error(`[invoice-pdf] PDF generation failed for invoice ${id}:`, err);
    return NextResponse.json({ success: false, error: "The invoice PDF could not be generated." }, { status: 500 });
  }
  if (!pdfBuffer.length) {
    console.error(`[invoice-pdf] empty PDF rendered for invoice ${id}`);
    return NextResponse.json({ success: false, error: "The invoice PDF could not be generated." }, { status: 500 });
  }

  // ?download=1 saves the file; without it the PDF opens in the browser viewer.
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `invoice-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
