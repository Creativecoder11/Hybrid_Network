"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, AlertTriangle, FileCheck2, Files, Ban, DollarSign, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { reprocessBatchAction, assignChargeCustomerAction } from "@/lib/actions/cdrPricingImport";
import { UnallocatedAlertBanner, type ReasonCount } from "@/components/admin/UnallocatedAlertBanner";
import { AssignAccountControl, type AccountOption } from "@/components/admin/AssignAccountControl";
import { formatDateTime, formatNumber, formatCurrency } from "@/lib/utils/format";
import type { CdrImportBatchRow, CdrChargeRecordRow } from "@/lib/types/retailBilling";

const STATUS_LABEL: Record<CdrChargeRecordRow["status"], string> = {
  MATCHED: "Allocated",
  UNMATCHED: "Unallocated",
  INVALID: "Invalid",
  DUPLICATE: "Duplicate",
};

export function CdrImportBatchDetailClient({
  batch,
  records,
  reasons,
  accountOptions,
}: {
  batch: CdrImportBatchRow;
  records: CdrChargeRecordRow[];
  reasons: ReasonCount[];
  accountOptions: AccountOption[];
}) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | CdrChargeRecordRow["status"]>(
    batch.unmatchedRows > 0 ? "UNMATCHED" : "ALL"
  );

  const filtered = useMemo(
    () => (statusFilter === "ALL" ? records : records.filter((r) => r.status === statusFilter)),
    [records, statusFilter]
  );

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
            Uploaded by {batch.uploadedByName} · {formatDateTime(batch.createdAt)} · Upload ID{" "}
            <span className="font-mono">{batch.id}</span>
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Columns — Customer Code: <span className="font-mono">{batch.customerCodeColumn || "not found"}</span> · Product
            Code: <span className="font-mono">{batch.identifierColumn || "--"}</span> · Type:{" "}
            <span className="font-mono">{batch.recordTypeColumn || "--"}</span> · Wholesale:{" "}
            <span className="font-mono">{batch.wholesaleColumn || "--"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/admin/cdr-import/${batch.id}/export`}>
            <Button variant="outline">
              <Download className="size-4" />
              Export All
            </Button>
          </a>
        </div>
      </div>

      {batch.status === "COMPLETED" && (
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold text-text-primary">Upload completed</p>
          <p className="mt-1 text-text-secondary">
            Total records: <strong>{formatNumber(batch.totalRows)}</strong> · Allocated:{" "}
            <strong className="text-accent-green">{formatNumber(batch.matchedRows)}</strong> · Unallocated:{" "}
            <strong className="text-amber">{formatNumber(batch.unmatchedRows)}</strong>
            {batch.duplicateRows > 0 && <> · Duplicates skipped: <strong>{formatNumber(batch.duplicateRows)}</strong></>}
            {batch.invalidRows > 0 && <> · Invalid: <strong className="text-red">{formatNumber(batch.invalidRows)}</strong></>}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {batch.distinctCustomerCodes > 1
              ? `Bulk file — ${formatNumber(batch.distinctCustomerCodes)} customer codes.`
              : batch.distinctCustomerCodes === 1
                ? "Single-customer file."
                : "No customer codes found in this file."}
            {batch.processingMs > 0 && ` Processed in ${(batch.processingMs / 1000).toFixed(1)}s.`}
          </p>
        </div>
      )}

      <UnallocatedAlertBanner
        pipeline="RETAIL"
        batchId={batch.id}
        totalRows={batch.totalRows}
        allocatedRows={batch.matchedRows}
        unallocatedRows={batch.unmatchedRows}
        reasons={reasons}
        reportHref={`/api/admin/cdr-import/${batch.id}/unallocated-report`}
        acknowledged={batch.alertAcknowledged}
        onReprocess={() => reprocessBatchAction(batch.id)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Records" value={formatNumber(batch.totalRows)} icon={Files} tone="blue" />
        <StatCard label="Allocated" value={formatNumber(batch.matchedRows)} icon={FileCheck2} tone="green" />
        <StatCard label="Unallocated" value={formatNumber(batch.unmatchedRows)} icon={AlertTriangle} tone="amber" />
        <StatCard
          label="Duplicate / Invalid"
          value={`${formatNumber(batch.duplicateRows)} / ${formatNumber(batch.invalidRows)}`}
          icon={batch.duplicateRows > 0 ? Copy : Ban}
          tone="red"
        />
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
            <option value="MATCHED">Allocated</option>
            <option value="UNMATCHED">Unallocated</option>
            <option value="DUPLICATE">Duplicate</option>
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
                  <TH>Customer Code</TH>
                  <TH>Product Code</TH>
                  <TH>Account / Customer</TH>
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
                    <TD className="font-mono text-xs">{r.customerCode || "--"}</TD>
                    <TD className="font-mono text-xs">
                      {r.identifier || "--"}
                      {r.recordType && <span className="block text-[10px] text-text-muted">{r.recordType}</span>}
                    </TD>
                    <TD>
                      {r.accountNumber ? <span className="font-mono text-xs">{r.accountNumber}</span> : "--"}
                      {r.customerName && <span className="block text-xs text-text-muted">{r.customerName}</span>}
                    </TD>
                    <TD>{formatCurrency(r.wholesaleAmount, r.currency)}</TD>
                    <TD>{r.retailPlanName || "--"}</TD>
                    <TD className="font-medium">
                      {r.status === "MATCHED" ? formatCurrency(r.retailAmount, r.currency) : "--"}
                    </TD>
                    <TD>
                      <Badge
                        tone={r.status === "MATCHED" ? "green" : r.status === "UNMATCHED" ? "amber" : r.status === "DUPLICATE" ? "neutral" : "red"}
                      >
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </TD>
                    <TD className="max-w-xs text-xs text-text-muted" title={r.errorReason}>
                      {r.unallocatedReason && <span className="block font-medium text-amber">{r.unallocatedReason}</span>}
                      <span className="line-clamp-2">{r.errorReason || "--"}</span>
                      {r.status === "UNMATCHED" && accountOptions.length > 0 && (
                        <div className="mt-1.5">
                          <AssignAccountControl recordId={r.id} accounts={accountOptions} onAssign={assignChargeCustomerAction} />
                        </div>
                      )}
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
