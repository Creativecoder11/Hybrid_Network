import "server-only";
import { connectDB } from "@/lib/db/connect";
import { CustomerAccount } from "@/models/CustomerAccount";
import { User } from "@/models/User";
import { reasonLabel } from "@/lib/cdr/allocation";
import type { AccountOption } from "@/components/admin/AssignAccountControl";
import type { ReasonCount } from "@/components/admin/UnallocatedAlertBanner";
import type { CdrChargeRecordRow } from "@/lib/types/retailBilling";

/** Customer Accounts for the manual "allocate to…" control ("10001 — ABC Marine"). */
export async function loadAccountOptions(): Promise<AccountOption[]> {
  await connectDB();
  const accounts = await CustomerAccount.find({ status: { $ne: "CLOSED" } })
    .select("accountNumber customer")
    .sort({ accountNumber: 1 })
    .limit(5000)
    .lean();
  const owners = await User.find({ _id: { $in: Array.from(new Set(accounts.map((a) => a.customer.toString()))) } })
    .select("name company")
    .lean();
  const ownerName = new Map(owners.map((o) => [o._id.toString(), o.company || o.name]));
  return accounts.map((a) => ({
    id: a._id.toString(),
    label: `${a.accountNumber} — ${ownerName.get(a.customer.toString()) ?? "Unknown customer"}`,
  }));
}

export function toReasonCounts(rows: { _id: string | null; count: number }[]): ReasonCount[] {
  return rows
    .map((r) => ({ code: r._id ?? "UNKNOWN", label: reasonLabel(r._id), count: r.count }))
    .sort((a, b) => b.count - a.count);
}

/** Maps a (populated) CdrChargeRecord to the admin table row. */
export function toChargeRow(r: {
  _id: { toString(): string };
  rowNumber: number;
  identifier: string;
  description: string;
  recordType?: string | null;
  customer?: unknown;
  customerCode?: string | null;
  customerAccount?: unknown;
  wholesaleAmount: number;
  currency?: string | null;
  retailPlanName?: string | null;
  pricingMethodUsed?: CdrChargeRecordRow["pricingMethodUsed"];
  markupPercentUsed?: number | null;
  fixedPriceUsed?: number | null;
  retailAmount: number;
  status: CdrChargeRecordRow["status"];
  unallocatedReasonCode?: string | null;
  errorReason?: string | null;
  invoice?: unknown;
  createdAt?: Date;
}): CdrChargeRecordRow {
  const customer = r.customer as { _id: { toString(): string }; name: string; company?: string } | null;
  const account = r.customerAccount as { accountNumber?: string } | null;
  return {
    id: r._id.toString(),
    rowNumber: r.rowNumber,
    identifier: r.identifier,
    description: r.description,
    recordType: r.recordType ?? "",
    customerId: customer ? customer._id.toString() : "",
    customerName: customer ? customer.company || customer.name : "",
    customerCode: r.customerCode ?? "",
    accountNumber: account?.accountNumber ?? "",
    wholesaleAmount: r.wholesaleAmount,
    currency: r.currency ?? "USD",
    retailPlanName: r.retailPlanName ?? "",
    pricingMethodUsed: r.pricingMethodUsed ?? null,
    markupPercentUsed: r.markupPercentUsed ?? null,
    fixedPriceUsed: r.fixedPriceUsed ?? null,
    retailAmount: r.retailAmount,
    status: r.status,
    unallocatedReason: r.status === "UNMATCHED" ? reasonLabel(r.unallocatedReasonCode) : "",
    errorReason: r.errorReason ?? "",
    invoiceId: r.invoice ? String(r.invoice) : null,
    createdAt: r.createdAt ? r.createdAt.toISOString() : "",
  };
}
