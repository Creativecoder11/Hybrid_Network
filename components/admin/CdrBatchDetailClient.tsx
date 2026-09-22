"use client";

import Link from "next/link";
import { ArrowLeft, Download, AlertTriangle, FileCheck2, Files, UserX, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { UnallocatedAlertBanner, type ReasonCount } from "@/components/admin/UnallocatedAlertBanner";
import { AssignAccountControl, type AccountOption } from "@/components/admin/AssignAccountControl";
import { assignUnmatchedRecordAction, reprocessCdrBatchAction } from "@/lib/actions/cdr";
import { formatDate, formatDateTime, formatNumber, formatPeriodMonth } from "@/lib/utils/format";
import type { CdrBatchRow, UnmatchedCdrRow } from "@/lib/types/cdr";

export function CdrBatchDetailClient({
  batch,
  unmatchedRows,
  reasons,
  accountOptions,
}: {
  batch: CdrBatchRow;
  unmatchedRows: UnmatchedCdrRow[];
  reasons: ReasonCount[];
  accountOptions: AccountOption[];
}) {
  const reportHref = `/api/admin/cdr/${batch.id}/unmatched`;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/cdr-upload"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to CDR Upload
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
            {batch.provider} · {batch.periodMonth ? formatPeriodMonth(batch.periodMonth) : "Unknown period"} · Uploaded by{" "}
            {batch.uploadedByName} · {formatDateTime(batch.createdAt)}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Upload ID <span className="font-mono">{batch.id}</span> ·{" "}
            {batch.distinctCustomerCodes > 1
              ? `Bulk file — ${formatNumber(batch.distinctCustomerCodes)} customer codes`
              : batch.distinctCustomerCodes === 1
                ? "Single-customer file"
                : "No customer codes found"}
          </p>
        </div>
        {unmatchedRows.length > 0 && (
          <a href={reportHref}>
            <Button variant="outline">
              <Download className="size-4" />
              Unallocated Report (.csv)
            </Button>
          </a>
        )}
      </div>

      <UnallocatedAlertBanner
        pipeline="RATED"
        batchId={batch.id}
        totalRows={batch.matchedRows + batch.unmatchedRows + batch.duplicateRows}
        allocatedRows={batch.matchedRows}
        unallocatedRows={batch.unmatchedRows}
        reasons={reasons}
        reportHref={reportHref}
        acknowledged={batch.alertAcknowledged}
        onReprocess={() => reprocessCdrBatchAction(batch.id)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Rows" value={formatNumber(batch.totalRows)} icon={Files} tone="blue" />
        <StatCard label="Allocated" value={formatNumber(batch.matchedRows)} icon={FileCheck2} tone="green" />
        <StatCard label="Unallocated" value={formatNumber(batch.unmatchedRows)} icon={UserX} tone="amber" />
        <StatCard
          label="Duplicates / Skipped"
          value={`${formatNumber(batch.duplicateRows)} / ${formatNumber(batch.skippedRows)}`}
          icon={Copy}
          tone="neutral"
        />
      </div>

      {batch.errorLog.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red">
              <AlertTriangle className="size-3.5" />
              Processing notes
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
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Unallocated Records</h2>
        {unmatchedRows.length === 0 ? (
          <EmptyState icon={FileCheck2} title="Every record was allocated" />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Cdr ID</TH>
                  <TH>Customer Code</TH>
                  <TH>Product Code</TH>
                  <TH>Date</TH>
                  <TH>Data Volume</TH>
                  <TH>Reason</TH>
                  <TH>Allocate To</TH>
                </TR>
              </THead>
              <TBody>
                {unmatchedRows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs">{r.cdrId || "--"}</TD>
                    <TD className="font-mono text-xs">{r.customerCode || "--"}</TD>
                    <TD className="font-mono text-xs">{r.productCode || "--"}</TD>
                    <TD>{r.startCdr ? formatDate(r.startCdr) : formatPeriodMonth(r.period)}</TD>
                    <TD>{r.volumeDataGB.toFixed(2)} GB</TD>
                    <TD className="max-w-xs text-xs" title={r.reason}>
                      <span className="block font-medium text-amber">{r.reasonLabel}</span>
                      <span className="line-clamp-2 text-text-muted">{r.reason}</span>
                    </TD>
                    <TD>
                      <AssignAccountControl recordId={r.id} accounts={accountOptions} onAssign={assignUnmatchedRecordAction} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </div>
  );
}
