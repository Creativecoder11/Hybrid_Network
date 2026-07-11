"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, AlertTriangle, FileCheck2, Files, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { assignUnmatchedRecordAction } from "@/lib/actions/cdr";
import { formatDateTime, formatNumber, formatPeriodMonth } from "@/lib/utils/format";
import type { CdrBatchRow, UnmatchedCdrRow } from "@/lib/types/cdr";

export function CdrBatchDetailClient({
  batch,
  unmatchedRows,
  customerOptions,
}: {
  batch: CdrBatchRow;
  unmatchedRows: UnmatchedCdrRow[];
  customerOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

  async function handleAssign(recordId: string) {
    const customerId = selections[recordId];
    if (!customerId) {
      toast.error("Pick a customer first.");
      return;
    }
    setAssigning(recordId);
    const result = await assignUnmatchedRecordAction(recordId, customerId);
    setAssigning(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Assigned.");
      router.refresh();
    }
  }

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
            <h1 className="text-xl font-bold text-text-primary">{batch.fileName}</h1>
            <Badge tone={batch.status === "COMPLETED" ? "green" : batch.status === "FAILED" ? "red" : "amber"}>
              {batch.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {batch.provider} · {batch.periodMonth ? formatPeriodMonth(batch.periodMonth) : "Unknown period"} ·
            Uploaded by {batch.uploadedByName} · {formatDateTime(batch.createdAt)}
          </p>
        </div>
        {unmatchedRows.length > 0 && (
          <a href={`/api/admin/cdr/${batch.id}/unmatched`}>
            <Button variant="outline">
              <Download className="size-4" />
              Download Unmatched CSV
            </Button>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Rows" value={formatNumber(batch.totalRows)} icon={Files} tone="blue" />
        <StatCard label="Matched" value={formatNumber(batch.matchedRows)} icon={FileCheck2} tone="green" />
        <StatCard label="Unmatched" value={formatNumber(batch.unmatchedRows)} icon={UserX} tone="amber" />
        <StatCard label="Skipped (totals row)" value={formatNumber(batch.skippedRows)} tone="neutral" />
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
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Unmatched Rows</h2>
        {unmatchedRows.length === 0 ? (
          <EmptyState icon={FileCheck2} title="Every row matched a customer" />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Cdr ID</TH>
                  <TH>Customer Code</TH>
                  <TH>ICCID</TH>
                  <TH>Card Name</TH>
                  <TH>Period</TH>
                  <TH>Data Volume</TH>
                  <TH>Assign To</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {unmatchedRows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs">{r.cdrId}</TD>
                    <TD>{r.customerCode || "--"}</TD>
                    <TD className="font-mono text-xs">{r.iccid || "--"}</TD>
                    <TD>{r.cardName || "--"}</TD>
                    <TD>{formatPeriodMonth(r.period)}</TD>
                    <TD>{r.volumeDataGB.toFixed(2)} GB</TD>
                    <TD>
                      <Select
                        className="h-8 w-48 py-0 text-xs"
                        value={selections[r.id] ?? ""}
                        onChange={(e) => setSelections((s) => ({ ...s, [r.id]: e.target.value }))}
                      >
                        <option value="">Select customer...</option>
                        {customerOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={assigning === r.id}
                        onClick={() => handleAssign(r.id)}
                      >
                        Assign
                      </Button>
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
