"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { CdrRecord } from "@/models/CdrRecord";
import { UsageRecord } from "@/models/UsageRecord";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/actions/customers";

export async function assignUnmatchedRecordAction(
  recordId: string,
  customerId: string
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const record = await CdrRecord.findById(recordId);
  if (!record) return { error: "CDR record not found." };
  if (record.matched) return { error: "This record has already been assigned." };

  const customer = await User.findOne({ _id: customerId, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };

  record.customer = customer._id;
  record.matched = true;
  await record.save();

  const existing = await UsageRecord.findOne({ customer: customer._id, periodMonth: record.period });
  const hadManual = existing?.source === "MANUAL" || existing?.source === "CDR+MANUAL";

  await UsageRecord.findOneAndUpdate(
    { customer: customer._id, periodMonth: record.period },
    {
      $inc: {
        volumeDataBytes: record.volumeDataBytes,
        volumeMin: record.volumeMin,
        volumeMsg: record.volumeMsg,
        volumeInBundleBytes: record.volumeInBundleBytes,
        volumeOutBundleBytes: record.volumeOutBundleBytes,
        volumeTotalBytes: record.volumeTotalBytes,
        consumptionMoney: record.consumptionMoney,
        consumptionDataBytes: record.consumptionDataBytes,
        consumptionMin: record.consumptionMin,
        consumptionMsg: record.consumptionMsg,
        cdrPriceTotal: record.priceTotal,
        cdrPriceInvoiced: record.priceInvoiced,
      },
      $set: {
        source: hadManual ? "CDR+MANUAL" : "CDR",
        currency: record.priceCurrency,
        cdrBatch: record.cdrBatch,
        lastUpdatedBy: admin.id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "CDR_UPLOAD",
    meta: { event: "MANUAL_ASSIGN", recordId, period: record.period },
  });

  revalidatePath(`/admin/cdr-upload/${record.cdrBatch.toString()}`);
  revalidatePath(`/admin/customers/${customer._id.toString()}`);
  return { success: `Assigned to ${customer.name}.` };
}
