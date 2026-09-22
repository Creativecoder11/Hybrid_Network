"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CustomerAccount } from "@/models/CustomerAccount";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { reprocessUnmatchedRecords } from "@/lib/cdr/retailCdrProcess";
import type { ActionState } from "@/lib/actions/customers";

/** Re-runs allocation + pricing for a batch's unallocated records against the current accounts and Product Codes. */
export async function reprocessBatchAction(batchId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(batchId)) return { error: "Upload not found." };

  const { reMatched, stillUnmatched } = await reprocessUnmatchedRecords(batchId, admin.id);

  await ActivityLog.create({
    actor: admin.id,
    action: "CDR_PRICING_REPROCESSED",
    meta: { batchId, reMatched, stillUnmatched },
  });

  revalidatePath(`/admin/billing/cdr-import/${batchId}`);
  revalidatePath("/admin/billing/cdr-import");

  if (reMatched === 0) {
    return {
      error: `No records could be allocated yet — ${stillUnmatched} still unallocated. Add the missing Customer Account or Product Code (with a Retail Plan) first.`,
    };
  }
  return {
    success: `Allocated ${reMatched} record${reMatched === 1 ? "" : "s"}. ${stillUnmatched} still unallocated.`,
  };
}

/**
 * Manually allocates an unallocated charge to a Customer Account chosen by the
 * admin. The Product Code still has to resolve (with pricing) for the charge
 * to become billable.
 */
export async function assignChargeCustomerAction(recordId: string, accountId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(recordId) || !mongoose.isValidObjectId(accountId)) return { error: "Invalid selection." };

  await connectDB();
  const [record, account] = await Promise.all([
    CdrChargeRecord.findById(recordId).select("importBatch status").lean(),
    CustomerAccount.findById(accountId).select("accountNumber customer").lean(),
  ]);
  if (!record) return { error: "Charge record not found." };
  if (record.status !== "UNMATCHED") return { error: "This record is not unallocated." };
  if (!account) return { error: "Customer Account not found." };

  const batchId = record.importBatch.toString();
  const { reMatched } = await reprocessUnmatchedRecords(batchId, admin.id, { recordIds: [recordId], forcedAccountId: accountId });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: account.customer,
    targetAccount: account._id,
    action: "CDR_PRICING_REPROCESSED",
    meta: { event: "MANUAL_ACCOUNT_ASSIGN", recordId, accountNumber: account.accountNumber, allocated: reMatched === 1 },
  });

  revalidatePath(`/admin/billing/cdr-import/${batchId}`);
  if (reMatched === 0) {
    return {
      error: `Assigned to account ${account.accountNumber}, but the Product Code is still not valid or has no Retail Plan — fix the product, then reprocess.`,
    };
  }
  return { success: `Allocated to account ${account.accountNumber}.` };
}
