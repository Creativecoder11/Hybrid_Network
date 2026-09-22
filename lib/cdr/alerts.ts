import "server-only";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { CdrBatch } from "@/models/CdrBatch";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { sendMail } from "@/lib/email/mailer";
import { unallocatedCdrAlertEmailHtml } from "@/emails/templates";
import { reasonLabel } from "./allocation";

// Unallocated-record alerts. An upload with unallocated rows is an "open
// alert" until an admin acknowledges it — shown on the admin bell and the CDR
// pages — and triggers one email to the Super Admins and the uploader. Built
// on the existing batch documents + ActivityLog + mailer rather than a
// separate notification system.

export type CdrPipeline = "RATED" | "RETAIL";

export function batchHref(pipeline: CdrPipeline, batchId: string): string {
  return pipeline === "RATED" ? `/admin/cdr-upload/${batchId}` : `/admin/billing/cdr-import/${batchId}`;
}

export async function notifyUnallocatedRecords(params: {
  pipeline: CdrPipeline;
  batchId: string;
  fileName: string;
  uploadedById: string;
  totalRows: number;
  allocatedRows: number;
  unallocatedRows: number;
  reasonCounts: Record<string, number>;
}): Promise<void> {
  if (params.unallocatedRows <= 0) return;
  await connectDB();

  const reasons = Object.entries(params.reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ label: reasonLabel(code), count }));

  await ActivityLog.create({
    actor: params.uploadedById,
    action: "CDR_UNALLOCATED_ALERT",
    meta: {
      pipeline: params.pipeline,
      batchId: params.batchId,
      fileName: params.fileName,
      unallocatedRows: params.unallocatedRows,
      reasons: params.reasonCounts,
    },
  });

  try {
    const [uploader, superAdmins] = await Promise.all([
      User.findById(params.uploadedById).select("name email").lean(),
      User.find({ role: "SUPER_ADMIN", status: "ACTIVE" }).select("email").lean(),
    ]);
    const recipients = Array.from(new Set([...superAdmins.map((a) => a.email), uploader?.email].filter(Boolean))) as string[];
    const base = process.env.ADMIN_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const html = unallocatedCdrAlertEmailHtml({
      fileName: params.fileName,
      uploadedBy: uploader?.name ?? "an administrator",
      totalRows: params.totalRows,
      allocatedRows: params.allocatedRows,
      unallocatedRows: params.unallocatedRows,
      reasons,
      reportUrl: `${base}${batchHref(params.pipeline, params.batchId)}`,
    });
    await Promise.all(
      recipients.map((to) =>
        sendMail({ to, subject: `Unallocated CDR records: ${params.unallocatedRows} in ${params.fileName}`, html })
      )
    );
  } catch (err) {
    // The in-app alert above is the source of truth; a mail failure must not
    // fail the upload.
    console.error("[cdr-alerts] failed to email unallocated alert", err);
  }
}

export type OpenCdrAlert = {
  id: string;
  pipeline: CdrPipeline;
  fileName: string;
  unallocatedRows: number;
  createdAt: string;
  href: string;
};

const OPEN_FILTER = { status: "COMPLETED" as const, unmatchedRows: { $gt: 0 }, alertAcknowledgedAt: null };

export async function listOpenCdrAlerts(limit = 10): Promise<OpenCdrAlert[]> {
  await connectDB();
  const [rated, retail] = await Promise.all([
    CdrBatch.find(OPEN_FILTER).sort({ createdAt: -1 }).limit(limit).select("fileName unmatchedRows createdAt").lean(),
    CdrImportBatch.find(OPEN_FILTER).sort({ createdAt: -1 }).limit(limit).select("fileName unmatchedRows createdAt").lean(),
  ]);
  return [
    ...rated.map((b) => ({ pipeline: "RATED" as const, b })),
    ...retail.map((b) => ({ pipeline: "RETAIL" as const, b })),
  ]
    .map(({ pipeline, b }) => ({
      id: b._id.toString(),
      pipeline,
      fileName: b.fileName,
      unallocatedRows: b.unmatchedRows ?? 0,
      createdAt: (b.createdAt as Date).toISOString(),
      href: batchHref(pipeline, b._id.toString()),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function countOpenCdrAlerts(): Promise<number> {
  await connectDB();
  const [rated, retail] = await Promise.all([
    CdrBatch.countDocuments(OPEN_FILTER),
    CdrImportBatch.countDocuments(OPEN_FILTER),
  ]);
  return rated + retail;
}
