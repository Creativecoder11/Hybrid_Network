import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { syncOverdueStatuses } from "@/lib/billing/statusSync";
import { BillingPageClient } from "@/components/admin/BillingPageClient";
import type { BillableCustomerOption, InvoiceListRow } from "@/lib/types/billing";

export const metadata: Metadata = {
  title: "Billing | Hybrid Networks Admin",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const customerId = typeof sp.customerId === "string" ? sp.customerId : "";
  const period = typeof sp.period === "string" ? sp.period : "";

  await syncOverdueStatuses();
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;
  if (customerId) filter.customer = customerId;
  if (period) filter.periodMonth = period;

  const invoices = await Invoice.find(filter).sort({ issueDate: -1 }).limit(200).populate("customer").lean();

  const rows: InvoiceListRow[] = invoices.map((inv) => {
    const customer = inv.customer as unknown as { _id: string; name: string; customerCode?: string } | null;
    return {
      id: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber,
      customerId: customer?._id?.toString() ?? "",
      customerName: customer?.name ?? "Unknown",
      customerCode: customer?.customerCode ?? "",
      periodMonth: inv.periodMonth,
      issueDate: (inv.issueDate as Date).toISOString(),
      dueDate: (inv.dueDate as Date).toISOString(),
      total: inv.total,
      currency: inv.currency ?? "MYR",
      status: inv.status,
    };
  });

  const customers = await User.find({ role: "CUSTOMER" }).sort({ name: 1 }).lean();
  const activeSubs = await Subscription.find({
    customer: { $in: customers.map((c) => c._id) },
    status: "ACTIVE",
  }).lean();
  const planByCustomer = new Map(activeSubs.map((s) => [s.customer.toString(), s.plan.toString()]));

  const customerOptions: BillableCustomerOption[] = customers
    .filter((c) => planByCustomer.has(c._id.toString()))
    .map((c) => ({
      id: c._id.toString(),
      label: `${c.name}${c.customerCode ? ` (${c.customerCode})` : ""}`,
      planId: planByCustomer.get(c._id.toString()) ?? "",
    }));

  return (
    <BillingPageClient
      rows={rows}
      status={status}
      customerId={customerId}
      period={period}
      customerOptions={customerOptions}
      allCustomers={customers.map((c) => ({ id: c._id.toString(), label: c.name }))}
    />
  );
}
