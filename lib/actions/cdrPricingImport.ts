"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { reprocessUnmatchedRecords } from "@/lib/cdr/retailCdrProcess";
import type { ActionState } from "@/lib/actions/customers";

/** Re-runs pricing for a batch's UNMATCHED records against the current mapping table. */
export async function reprocessBatchAction(batchId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const { reMatched, stillUnmatched } = await reprocessUnmatchedRecords(batchId);

  await ActivityLog.create({
    actor: admin.id,
    action: "CDR_PRICING_REPROCESSED",
    meta: { batchId, reMatched, stillUnmatched },
  });

  revalidatePath(`/admin/billing/cdr-import/${batchId}`);
  revalidatePath("/admin/billing/cdr-import");

  if (reMatched === 0) {
    return { error: "No previously-unmatched records could be matched to a Retail Plan yet." };
  }
  return {
    success: `Re-matched ${reMatched} record${reMatched === 1 ? "" : "s"}. ${stillUnmatched} still unmatched.`,
  };
}

/** Manually attaches a customer to a priced charge record that had no automatic customer match. */
export async function assignChargeCustomerAction(recordId: string, customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();

  const record = await CdrChargeRecord.findById(recordId);
  if (!record) return { error: "Charge record not found." };
  if (record.customer) return { error: "This record is already assigned to a customer." };

  const customer = await User.findOne({ _id: customerId, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };

  record.customer = customer._id;
  record.customerCode = customer.customerCode ?? "";
  await record.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "CDR_PRICING_REPROCESSED",
    meta: { event: "MANUAL_CUSTOMER_ASSIGN", recordId },
  });

  revalidatePath(`/admin/billing/cdr-import/${record.importBatch.toString()}`);
  return { success: `Assigned to ${customer.name}.` };
}
