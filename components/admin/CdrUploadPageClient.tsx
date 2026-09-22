"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Badge } from "@/components/ui/Badge";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime, formatNumber, formatPeriodMonth } from "@/lib/utils/format";
import type { CdrBatchRow } from "@/lib/types/cdr";
import Link from "next/link";

export function CdrUploadPageClient({ batches }: { batches: CdrBatchRow[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"REPLACE" | "ACCUMULATE">("REPLACE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!selectedFile) {
      toast.error("Choose a CDR file first.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("uploadMode", mode);

      const res = await fetch("/api/admin/cdr/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Upload failed.");
        if (json.data?.batchId) router.push(`/admin/cdr-upload/${json.data.batchId}`);
        return;
      }

      const d = json.data as { totalRows: number; matchedRows: number; unmatchedRows: number; duplicateRows: number };
      const summary = `Upload completed — ${d.totalRows} records: ${d.matchedRows} allocated, ${d.unmatchedRows} unallocated${d.duplicateRows ? `, ${d.duplicateRows} duplicates skipped` : ""}.`;
      if (d.unmatchedRows > 0) toast.warning(summary);
      else toast.success(summary);
      router.push(`/admin/cdr-upload/${json.data.batchId}`);
    } catch {
      toast.error("Something went wrong uploading the file.");
    } finally {
      setUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-2xl font-bold text-text-primary">CDR Upload</p>
        <p className="text-sm ">
          Upload a Rated CDR export (.xlsx or .csv) — single-customer or bulk. Each record is allocated by Customer Code →
          Customer Account and Product Code (&ldquo;Prod&rdquo;) → Product, and allocated usage updates that account&apos;s
          monthly totals. Unknown codes are reported as unallocated; nothing is created automatically. Records already
          uploaded are skipped as duplicates.
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
              if (f) setSelectedFile(f);
            }}
          >
            <UploadCloud className="size-8 text-text-muted" />
            {selectedFile ? (
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <FileSpreadsheet className="size-4 text-accent-green" />
                {selectedFile.name}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Drag & drop a file here, or click to browse</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              id="cdr-file-input"
            />
            <label
              htmlFor="cdr-file-input"
              className="cursor-pointer rounded-xl border border-line px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
            >
              Browse Files
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-secondary">Upload mode for existing periods</p>
              <SegmentedControl
                value={mode}
                onChange={setMode}
                options={[
                  { label: "Replace", value: "REPLACE", tone: "green" },
                  { label: "Accumulate", value: "ACCUMULATE", tone: "amber" },
                ]}
              />
              <p className="mt-1.5 text-xs text-text-muted">
                {mode === "REPLACE"
                  ? "Recomputes period totals from this file only."
                  : "Adds this file's totals on top of any existing usage for the period."}
              </p>
            </div>
            <Button onClick={handleUpload} loading={uploading} disabled={!selectedFile}>
              Upload &amp; Process
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="mb-3 text-sm font-semibold text-text-primary">Upload History</p>
        {batches.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No CDR files uploaded yet" />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>File</TH>
                  <TH>Uploaded By</TH>
                  <TH>Period</TH>
                  <TH>Mode</TH>
                  <TH>Records</TH>
                  <TH>Allocated</TH>
                  <TH>Unallocated</TH>
                  <TH>Duplicates</TH>
                  <TH>Status</TH>
                  <TH>Date</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {batches.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-medium text-text-primary">
                      {b.fileName}
                      <span className="block font-mono text-[10px] text-text-muted">{b.id}</span>
                    </TD>
                    <TD className="text-text-secondary">{b.uploadedByName}</TD>
                    <TD>{b.periodMonth ? formatPeriodMonth(b.periodMonth) : "--"}</TD>
                    <TD>
                      <Badge tone={b.uploadMode === "REPLACE" ? "blue" : "amber"}>{b.uploadMode}</Badge>
                    </TD>
                    <TD>{formatNumber(b.totalRows)}</TD>
                    <TD className="text-accent-green">{formatNumber(b.matchedRows)}</TD>
                    <TD className={b.unmatchedRows > 0 ? "text-amber" : "text-text-secondary"}>
                      {formatNumber(b.unmatchedRows)}
                    </TD>
                    <TD className="text-text-secondary">{formatNumber(b.duplicateRows)}</TD>
                    <TD>
                      <Badge tone={b.status === "COMPLETED" ? "green" : b.status === "FAILED" ? "red" : "amber"}>
                        {b.status}
                      </Badge>
                      {b.status === "FAILED" && b.errorLog.length > 0 && (
                        <span className="mt-1 block max-w-[220px] truncate text-[11px] text-red" title={b.errorLog.join("\n")}>
                          {b.errorLog[b.errorLog.length - 1]}
                        </span>
                      )}
                    </TD>
                    <TD className="text-text-secondary">{formatDateTime(b.createdAt)}</TD>
                    <TD>
                      <Link
                        href={`/admin/cdr-upload/${b.id}`}
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
