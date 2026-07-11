import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { buildInvoicePdfData } from "@/lib/billing/invoiceData";
import { renderInvoicePdf } from "@/lib/pdf/render";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
  }

  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN";
  const isOwner = user.role === "CUSTOMER" && invoice.customer.toString() === user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const pdfData = await buildInvoicePdfData(id);
  if (!pdfData) {
    return NextResponse.json({ success: false, error: "Could not build the invoice." }, { status: 500 });
  }

  const pdfBuffer = await renderInvoicePdf(pdfData);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
