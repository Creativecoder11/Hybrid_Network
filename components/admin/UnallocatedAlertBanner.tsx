"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Download, RefreshCw, Tag, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { acknowledgeCdrAlertAction } from "@/lib/actions/cdr";
import { formatNumber } from "@/lib/utils/format";
import type { ActionState } from "@/lib/actions/customers";

export type ReasonCount = { code: string; label: string; count: number };

// "UNALLOCATED RECORDS FOUND" alert shown on an upload's result page, shared
// by the usage (Rated CDR) and retail (pricing) pipelines.
export function UnallocatedAlertBanner({
  pipeline,
  batchId,
  totalRows,
  allocatedRows,
  unallocatedRows,
  reasons,
  reportHref,
  acknowledged,
  onReprocess,
}: {
  pipeline: "RATED" | "RETAIL";
  batchId: string;
  totalRows: number;
  allocatedRows: number;
  unallocatedRows: number;
  reasons: ReasonCount[];
  reportHref: string;
  acknowledged: boolean;
  onReprocess: () => Promise<ActionState>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"reprocess" | "ack" | null>(null);

  async function run(kind: "reprocess" | "ack", fn: () => Promise<ActionState>) {
    setPending(kind);
    const res = await fn();
    setPending(null);
    if (res?.error) toast.error(res.error);
    else {
      toast.success(res?.success ?? "Done.");
      router.refresh();
    }
  }

  if (unallocatedRows <= 0) return null;

  return (
    <div className="rounded-2xl border border-amber/30 bg-amber/5 p-5" role="alert">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber/15 text-amber">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <p className="text-base font-semibold uppercase tracking-wide text-amber">Unallocated records found</p>
            <p className="mt-1 text-sm text-text-primary">
              {formatNumber(unallocatedRows)} of {formatNumber(totalRows)} record(s) could not be allocated
              {allocatedRows > 0 ? ` · ${formatNumber(allocatedRows)} allocated` : ""}.
            </p>
            {reasons.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-text-secondary">
                {reasons.map((r) => (
                  <li key={r.code}>
                    <span className="font-semibold text-amber">{formatNumber(r.count)}</span> · {r.label}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 max-w-3xl text-xs text-text-muted">
              No customers or accounts were created automatically. Add the missing Customer Account or Product Code
              (or allocate records manually below), then reprocess.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          <a href={reportHref}>
            <Button size="sm" variant="outline" className="text-xs">
              <Download className="size-3.5" />
              View Report (.csv)
            </Button>
          </a>
          <Button size="sm" variant="outline" className="text-xs" loading={pending === "reprocess"} onClick={() => run("reprocess", onReprocess)}>
            <RefreshCw className="size-3.5" />
            Reprocess Unallocated
          </Button>
          <Link href="/admin/customers">
            <Button size="sm" variant="outline" className="text-xs">
              <Users className="size-3.5" />
              Customer Accounts
            </Button>
          </Link>
          <Link href="/admin/billing/identifier-mapping">
            <Button size="sm" variant="outline" className="text-xs">
              <Tag className="size-3.5" />
              Product Codes
            </Button>
          </Link>
          {!acknowledged && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              loading={pending === "ack"}
              onClick={() => run("ack", () => acknowledgeCdrAlertAction(pipeline, batchId))}
            >
              <Check className="size-3.5" />
              Acknowledge Alert
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
