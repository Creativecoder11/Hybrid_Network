import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { listAuthorizedAccounts } from "@/lib/accounts/access";
import { CUSTOMER_VISIBLE_STATUSES } from "@/lib/portal/billing";
import { buildInvoicePdfData } from "@/lib/billing/invoiceData";
import { renderInvoicePdf } from "@/lib/pdf/render";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const pdfData = await buildInvoicePdfData(id);
  if (!pdfData) {
    return NextResponse.json({ success: false, error: "Could not build the invoice." }, { status: 500 });
  }

  const pdfBuffer = await renderInvoicePdf(pdfData);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
