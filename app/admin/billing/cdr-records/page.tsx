import type { Metadata } from "next";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { loadAccountOptions, toChargeRow } from "@/lib/admin/cdrOptions";
import { BillingSubNav } from "@/components/admin/BillingSubNav";
import { CdrRecordsPageClient } from "@/components/admin/CdrRecordsPageClient";
import type { CdrChargeRecordRow } from "@/lib/types/retailBilling";

export const metadata: Metadata = {
  title: "CDR Records | Hybrid Networks Admin",
};

export default async function CdrRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const q = typeof sp.q === "string" ? sp.q : "";
  const batchId = typeof sp.batchId === "string" ? sp.batchId : "";

  await connectDB();

  // Matches both identifier and (populated) customer name, so the DB-level
  // filter only narrows by status/batch — the text search is applied below,
  // same trade-off as the Billing page's invoice search.
  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;
  if (batchId && mongoose.isValidObjectId(batchId)) filter.importBatch = batchId;

  const [recordDocs, batches, accountOptions] = await Promise.all([
    CdrChargeRecord.find(filter)
      .sort({ createdAt: -1 })
      .limit(300)
      .populate("customer", "name company")
      .populate("customerAccount", "accountNumber")
      .lean(),
    CdrImportBatch.find().sort({ createdAt: -1 }).limit(100).select("fileName").lean(),
    loadAccountOptions(),
  ]);

  let records: CdrChargeRecordRow[] = recordDocs.map((r) => toChargeRow(r as unknown as Parameters<typeof toChargeRow>[0]));

  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    records = records.filter(
      (r) =>
        r.identifier.toLowerCase().includes(needle) ||
        r.customerName.toLowerCase().includes(needle) ||
        r.customerCode.toLowerCase().includes(needle) ||
        r.accountNumber.toLowerCase().includes(needle)
    );
  }

  return (
    <div className="space-y-6">
      <BillingSubNav />
      <CdrRecordsPageClient
        records={records}
        status={status}
        q={q}
        batchId={batchId}
        batchOptions={batches.map((b) => ({ id: b._id.toString(), fileName: b.fileName }))}
        accountOptions={accountOptions}
      />
    </div>
  );
}
