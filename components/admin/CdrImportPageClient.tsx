"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime, formatCurrency, formatNumber } from "@/lib/utils/format";
import type { CdrImportBatchRow } from "@/lib/types/retailBilling";
import type { RetailCdrPreview, RetailCdrImportResult } from "@/lib/cdr/retailCdrProcess";

export function CdrImportPageClient({ batches }: { batches: CdrImportBatchRow[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<RetailCdrPreview | null>(null);
  const [identifierColumn, setIdentifierColumn] = useState("");
  const [wholesaleColumn, setWholesaleColumn] = useState("");

  function reset() {
    setSelectedFile(null);
    setPreview(null);
    setIdentifierColumn("");
    setWholesaleColumn("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePreview() {
    if (!selectedFile) {
      toast.error("Choose a CDR CSV file first.");
      return;
    }
    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mode", "preview");
      const res = await fetch("/api/admin/cdr-import/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Preview failed.");
        return;
      }
      const data = json.data as RetailCdrPreview;
      setPreview(data);
      setIdentifierColumn(data.detection.identifierColumn ?? "");
      setWholesaleColumn(data.detection.wholesaleColumn ?? "");
      if (data.invalidRows > 0) {
        toast.warning(`${data.invalidRows} of ${data.totalRows} rows failed validation — check the preview below.`);
      }
      if (data.duplicateOfBatch) {
        toast.warning(`This file looks identical to a previous import (${data.duplicateOfBatch.fileName}).`);
      }
    } catch {
      toast.error("Something went wrong reading the file.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!selectedFile) return;
    setCommitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mode", "commit");
      formData.append("identifierColumn", identifierColumn);
      formData.append("wholesaleColumn", wholesaleColumn);
      const res = await fetch("/api/admin/cdr-import/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Import failed.");
        if (json.data?.batchId) router.push(`/admin/billing/cdr-import/${json.data.batchId}`);
        return;
      }
      const data = json.data as RetailCdrImportResult;
      toast.success(`Processed ${data.totalRows} rows — ${data.matchedRows} matched, ${data.unmatchedRows} unmatched.`);
      router.push(`/admin/billing/cdr-import/${data.batchId}`);
    } catch {
      toast.error("Something went wrong importing the file.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-2xl font-bold text-text-primary">CDR Import</p>
        <p className="text-sm">
          Upload a wholesale CDR CSV to price it against your Retail Plans and prepare invoice-ready charges.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line p-10 text-center transition-colors hover:border-accent-green/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                reset();
                setSelectedFile(f);
              }
            }}
          >
            <UploadCloud className="size-8 text-text-muted" />
            {selectedFile ? (
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <FileSpreadsheet className="size-4 text-accent-green" />
                {selectedFile.name}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Drag &amp; drop a CSV file here, or click to browse</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                reset();
                setSelectedFile(e.target.files?.[0] ?? null);
              }}
              id="cdr-import-file-input"
            />
            <label
              htmlFor="cdr-import-file-input"
              className="cursor-pointer rounded-xl border border-line px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
            >
              Browse Files
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={handlePreview} loading={previewing} disabled={!selectedFile}>
              Validate &amp; Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardContent className="space-y-5 pt-5">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-text-muted">Total Rows</p>
                <p className="text-lg font-bold text-text-primary">{formatNumber(preview.totalRows)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Valid</p>
                <p className="text-lg font-bold text-accent-green">{formatNumber(preview.validRows)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Invalid</p>
                <p className="text-lg font-bold text-red">{formatNumber(preview.invalidRows)}</p>
              </div>
            </div>

            {preview.duplicateOfBatch && (
              <div className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-xs text-amber">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This file looks identical to{" "}
                  <Link href={`/admin/billing/cdr-import/${preview.duplicateOfBatch.id}`} className="underline">
                    {preview.duplicateOfBatch.fileName}
                  </Link>{" "}
                  imported {formatDateTime(preview.duplicateOfBatch.createdAt)}. Importing again will create duplicate
                  charge records unless the file has genuinely new rows.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Identifier column</p>
                <Select value={identifierColumn} onChange={(e) => setIdentifierColumn(e.target.value)}>
                  <option value="">-- none detected --</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Wholesale charge column</p>
                <Select value={wholesaleColumn} onChange={(e) => setWholesaleColumn(e.target.value)}>
                  <option value="">-- none detected --</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-text-primary">Preview (first {preview.sampleRows.length} rows)</p>
              <TableContainer>
                <Table>
                  <THead>
                    <TR>
                      <TH>Row</TH>
                      <TH>Identifier</TH>
                      <TH>Wholesale</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {preview.sampleRows.map((r) => (
                      <TR key={r.rowNumber}>
                        <TD className="text-text-muted">{r.rowNumber}</TD>
                        <TD className="font-mono text-xs">{r.identifier || "--"}</TD>
                        <TD>{r.wholesaleAmount === null ? r.wholesaleAmountRaw || "--" : r.wholesaleAmount}</TD>
                        <TD>
                          {r.isValid ? (
                            <Badge tone="green">Valid</Badge>
                          ) : (
                            <Badge tone="red" title={r.invalidReason}>
                              {r.invalidReason}
                            </Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} loading={committing} disabled={!identifierColumn || !wholesaleColumn}>
                <CheckCircle2 className="size-4" />
                Confirm Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-text-primary">Import History</p>
        {batches.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No CDR files imported yet" />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>File</TH>
                  <TH>Uploaded By</TH>
                  <TH>Rows</TH>
                  <TH>Matched</TH>
                  <TH>Unmatched</TH>
                  <TH>Invalid</TH>
                  <TH>Wholesale</TH>
                  <TH>Retail</TH>
                  <TH>Status</TH>
                  <TH>Date</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {batches.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-medium text-text-primary">{b.fileName}</TD>
                    <TD className="text-text-secondary">{b.uploadedByName}</TD>
                    <TD>{formatNumber(b.totalRows)}</TD>
                    <TD className="text-accent-green">{formatNumber(b.matchedRows)}</TD>
                    <TD className={b.unmatchedRows > 0 ? "text-amber" : "text-text-secondary"}>
                      {formatNumber(b.unmatchedRows)}
                    </TD>
                    <TD className={b.invalidRows > 0 ? "text-red" : "text-text-secondary"}>
                      {formatNumber(b.invalidRows)}
                    </TD>
                    <TD>{formatCurrency(b.totalWholesaleAmount, b.currency)}</TD>
                    <TD>{formatCurrency(b.totalRetailAmount, b.currency)}</TD>
                    <TD>
                      <Badge tone={b.status === "COMPLETED" ? "green" : b.status === "FAILED" ? "red" : "amber"}>
                        {b.status}
                      </Badge>
                    </TD>
                    <TD className="text-text-secondary">{formatDateTime(b.createdAt)}</TD>
                    <TD>
                      <Link
                        href={`/admin/billing/cdr-import/${b.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline"
                      >
                        View <ArrowRight className="size-3.5" />
                      </Link>
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
