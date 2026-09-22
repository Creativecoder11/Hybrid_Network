"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrBatch } from "@/models/CdrBatch";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { CdrRecord } from "@/models/CdrRecord";
import { CustomerAccount } from "@/models/CustomerAccount";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { reprocessUnallocatedCdrRecords } from "@/lib/cdr/process";
import type { ActionState } from "@/lib/actions/customers";

// Admin follow-up for Unallocated usage-CDR records (Admin -> CDR Upload).

export async function reprocessCdrBatchAction(batchId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(batchId)) return { error: "Upload not found." };

  const { reAllocated, stillUnallocated } = await reprocessUnallocatedCdrRecords(batchId, admin.id);
  await ActivityLog.create({
    actor: admin.id,
    action: "CDR_UNALLOCATED_REPROCESSED",
    meta: { pipeline: "RATED", batchId, reAllocated, stillUnallocated },
  });

  revalidatePath(`/admin/cdr-upload/${batchId}`);
  revalidatePath("/admin/cdr-upload");
  if (reAllocated === 0) {
    return { error: `No records could be allocated yet — ${stillUnallocated} still unallocated. Add the missing Customer Account or Product Code first.` };
  }
  return { success: `Allocated ${reAllocated} record${reAllocated === 1 ? "" : "s"}. ${stillUnallocated} still unallocated.` };
}

/**
 * Manually allocates an unallocated record to a Customer Account the admin
 * chose. The Product Code must still be valid for the record to count as
 * allocated; otherwise it stays unallocated with the product reason.
 */
export async function assignUnmatchedRecordAction(recordId: string, accountId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(recordId) || !mongoose.isValidObjectId(accountId)) return { error: "Invalid selection." };

  await connectDB();
  const [record, account] = await Promise.all([
    CdrRecord.findById(recordId).select("cdrBatch allocationStatus").lean(),
    CustomerAccount.findById(accountId).select("accountNumber customer").lean(),
  ]);
  if (!record) return { error: "CDR record not found." };
  if (record.allocationStatus !== "UNALLOCATED") return { error: "This record is not unallocated." };
  if (!account) return { error: "Customer Account not found." };

  const batchId = record.cdrBatch.toString();
  const { reAllocated } = await reprocessUnallocatedCdrRecords(batchId, admin.id, {
    recordIds: [recordId],
    forcedAccountId: accountId,
  });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: account.customer,
    targetAccount: account._id,
    action: "CDR_UNALLOCATED_REPROCESSED",
    meta: { pipeline: "RATED", event: "MANUAL_ASSIGN", recordId, accountNumber: account.accountNumber, allocated: reAllocated === 1 },
  });

  revalidatePath(`/admin/cdr-upload/${batchId}`);
  if (reAllocated === 0) {
    return { error: `Assigned to account ${account.accountNumber}, but the record's Product Code is still not valid — add or activate it, then reprocess.` };
  }
  return { success: `Allocated to account ${account.accountNumber}.` };
}

/** Clears an upload's unallocated-records alert from the admin bell. */
export async function acknowledgeCdrAlertAction(pipeline: "RATED" | "RETAIL", batchId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(batchId)) return { error: "Upload not found." };

  await connectDB();
  const Model = pipeline === "RATED" ? CdrBatch : CdrImportBatch;
  const res = await (Model as typeof CdrBatch).updateOne(
    { _id: batchId },
    { $set: { alertAcknowledgedAt: new Date(), alertAcknowledgedBy: admin.id } }
  );
  if (res.matchedCount === 0) return { error: "Upload not found." };

  await ActivityLog.create({ actor: admin.id, action: "CDR_ALERT_ACKNOWLEDGED", meta: { pipeline, batchId } });
  revalidatePath("/admin", "layout");
  return { success: "Alert acknowledged." };
}
