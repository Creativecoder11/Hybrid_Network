"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, AlertTriangle, FileCheck2, Files, RefreshCw, Ban, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { reprocessBatchAction } from "@/lib/actions/cdrPricingImport";
import { formatDateTime, formatNumber, formatCurrency } from "@/lib/utils/format";
import type { CdrImportBatchRow, CdrChargeRecordRow } from "@/lib/types/retailBilling";

export function CdrImportBatchDetailClient({
  batch,
  records,
}: {
  batch: CdrImportBatchRow;
  records: CdrChargeRecordRow[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNMATCHED" | "INVALID" | "MATCHED">(
    batch.unmatchedRows > 0 ? "UNMATCHED" : "ALL"
  );
  const [reprocessing, setReprocessing] = useState(false);

  const filtered = useMemo(
    () => (statusFilter === "ALL" ? records : records.filter((r) => r.status === statusFilter)),
    [records, statusFilter]
  );

  async function handleReprocess() {
    setReprocessing(true);
    const result = await reprocessBatchAction(batch.id);
    setReprocessing(false);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Reprocessed.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/billing/cdr-import"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to CDR Import
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xl font-bold text-text-primary">{batch.fileName}</p>
            <Badge tone={batch.status === "COMPLETED" ? "green" : batch.status === "FAILED" ? "red" : "amber"}>
              {batch.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Identifier column: <span className="font-mono">{batch.identifierColumn || "--"}</span> · Wholesale column:{" "}
            <span className="font-mono">{batch.wholesaleColumn || "--"}</span> · {formatDateTime(batch.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {batch.unmatchedRows > 0 && (
            <Button variant="outline" onClick={handleReprocess} loading={reprocessing}>
              <RefreshCw className="size-4" />
              Reprocess Unmatched
            </Button>
          )}
          <a href={`/api/admin/cdr-import/${batch.id}/export`}>
            <Button variant="outline">
              <Download className="size-4" />
              Export All
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Rows" value={formatNumber(batch.totalRows)} icon={Files} tone="blue" />
        <StatCard label="Matched" value={formatNumber(batch.matchedRows)} icon={FileCheck2} tone="green" />
        <StatCard label="Unmatched" value={formatNumber(batch.unmatchedRows)} icon={AlertTriangle} tone="amber" />
        <StatCard label="Invalid" value={formatNumber(batch.invalidRows)} icon={Ban} tone="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <DollarSign className="size-3.5" /> Total Wholesale
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {formatCurrency(batch.totalWholesaleAmount, batch.currency)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <DollarSign className="size-3.5" /> Total Retail
          </p>
          <p className="mt-1 text-lg font-bold text-accent-green">
            {formatCurrency(batch.totalRetailAmount, batch.currency)}
          </p>
        </Card>
      </div>

      {batch.errorLog.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red">
              <AlertTriangle className="size-3.5" />
              Errors
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-text-secondary">
              {batch.errorLog.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Records ({filtered.length})</h2>
          <Select
            className="sm:w-48"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="MATCHED">Matched</option>
            <option value="UNMATCHED">Unmatched</option>
            <option value="INVALID">Invalid</option>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No records for this filter" />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Row</TH>
                  <TH>Identifier</TH>
                  <TH>Customer</TH>
                  <TH>Wholesale</TH>
                  <TH>Retail Plan</TH>
                  <TH>Retail Charge</TH>
                  <TH>Status</TH>
                  <TH>Reason</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.slice(0, 300).map((r) => (
                  <TR key={r.id}>
                    <TD className="text-text-muted">{r.rowNumber}</TD>
                    <TD className="font-mono text-xs">{r.identifier || "--"}</TD>
                    <TD>{r.customerName || "--"}</TD>
                    <TD>{formatCurrency(r.wholesaleAmount, r.currency)}</TD>
                    <TD>{r.retailPlanName || "--"}</TD>
                    <TD className="font-medium">
                      {r.status === "MATCHED" ? formatCurrency(r.retailAmount, r.currency) : "--"}
                    </TD>
                    <TD>
                      <Badge
                        tone={r.status === "MATCHED" ? "green" : r.status === "UNMATCHED" ? "amber" : "red"}
                      >
                        {r.status}
                      </Badge>
                    </TD>
                    <TD className="max-w-xs truncate text-xs text-text-muted" title={r.errorReason}>
                      {r.errorReason || "--"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        {filtered.length > 300 && (
          <p className="mt-2 text-xs text-text-muted">
            Showing the first 300 of {filtered.length} records. Use{" "}
            <Link href={`/admin/billing/cdr-records?batchId=${batch.id}`} className="text-accent-blue hover:underline">
              CDR Records
            </Link>{" "}
            to browse the full set.
          </p>
        )}
      </div>
    </div>
  );
}
