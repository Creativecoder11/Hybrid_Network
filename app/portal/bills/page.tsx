import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { requireRole } from "@/lib/auth/dal";
import { syncOverdueStatuses } from "@/lib/billing/statusSync";
import { PortalBillsClient } from "@/components/portal/PortalBillsClient";
import type { PortalInvoiceRow } from "@/lib/types/portal";

export const metadata: Metadata = {
  title: "My Bills | Hybrid Networks Portal",
};

export default async function PortalBillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ALL";

  await syncOverdueStatuses();
  await connectDB();

  const filter: Record<string, unknown> = { customer: user.id };
  if (status !== "ALL") filter.status = status;

  const invoices = await Invoice.find(filter).sort({ issueDate: -1 }).lean();

  const rows: PortalInvoiceRow[] = invoices.map((inv) => ({
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    periodMonth: inv.periodMonth,
    issueDate: (inv.issueDate as Date).toISOString(),
    dueDate: (inv.dueDate as Date).toISOString(),
    total: inv.total,
    currency: inv.currency ?? "USD",
    status: inv.status,
  }));

  return <PortalBillsClient rows={rows} status={status} />;
}
