import type { Metadata } from "next";
import { getPortalContext } from "@/lib/accounts/access";
import { syncOverdueStatuses } from "@/lib/billing/statusSync";
import { listAccountInvoices } from "@/lib/portal/billing";
import { PortalBillsClient } from "@/components/portal/PortalBillsClient";
import { NoAccountState } from "@/components/portal/NoAccountState";

export const metadata: Metadata = {
  title: "My Bills | Hybrid Networks Portal",
};

export default async function PortalBillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getPortalContext();
  if (!ctx.account) return <NoAccountState title="My Bills" />;

  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ALL";

  await syncOverdueStatuses();
  const rows = await listAccountInvoices(ctx.account, { status: status === "ALL" ? undefined : status });

  return <PortalBillsClient rows={rows} status={status} accountNumber={ctx.account.accountNumber} />;
}
