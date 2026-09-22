import mongoose, { type Types } from "mongoose";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Invoice } from "@/models/Invoice";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import { CdrRecord } from "@/models/CdrRecord";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";

// Links existing bills, subscriptions, usage and CDR rows to a Customer
// Account. Before accounts existed every profile had exactly one Customer
// Code, so historical data belongs to the profile's primary (oldest) account;
// CDR rows are matched on their own customer code first. Only rows whose
// customerAccount is still null are touched, so this is safe to re-run.

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function backfillAccountLinks(log: (msg: string) => void) {
  const accounts = await CustomerAccount.find().sort({ createdAt: 1 }).lean();
  const byProfile = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const key = a.customer.toString();
    byProfile.set(key, [...(byProfile.get(key) ?? []), a]);
  }

  const totals = { invoices: 0, subscriptions: 0, usage: 0, cdrRecords: 0, chargeRecords: 0 };

  for (const [profileId, profileAccounts] of byProfile) {
    const customer = new mongoose.Types.ObjectId(profileId);
    const primary = profileAccounts[0];

    for (const account of profileAccounts) {
      const codeMatch = { $regex: `^${escapeRegex(account.accountNumber)}$`, $options: "i" };
      const byCode = await CdrRecord.updateMany(
        { customer, customerAccount: null, customerCode: codeMatch },
        { $set: { customerAccount: account._id } }
      );
      const chargesByCode = await CdrChargeRecord.updateMany(
        { customer, customerAccount: null, customerCode: codeMatch },
        { $set: { customerAccount: account._id } }
      );
      totals.cdrRecords += byCode.modifiedCount;
      totals.chargeRecords += chargesByCode.modifiedCount;
    }

    const primaryId = primary._id as Types.ObjectId;
    const [inv, sub, usage, cdr, charges] = await Promise.all([
      // updateMany isn't covered by Invoice's soft-delete query hook, so this
      // also links invoices sitting in the Trash.
      Invoice.updateMany(
        { customer, customerAccount: null },
        { $set: { customerAccount: primaryId, accountNumber: primary.accountNumber } }
      ),
      Subscription.updateMany({ customer, customerAccount: null }, { $set: { customerAccount: primaryId } }),
      UsageRecord.updateMany({ customer, customerAccount: null }, { $set: { customerAccount: primaryId } }),
      CdrRecord.updateMany({ customer, customerAccount: null }, { $set: { customerAccount: primaryId } }),
      CdrChargeRecord.updateMany({ customer, customerAccount: null }, { $set: { customerAccount: primaryId } }),
    ]);
    totals.invoices += inv.modifiedCount;
    totals.subscriptions += sub.modifiedCount;
    totals.usage += usage.modifiedCount;
    totals.cdrRecords += cdr.modifiedCount;
    totals.chargeRecords += charges.modifiedCount;
  }

  // Rated-CDR rows from before allocation statuses existed.
  const [allocated, unallocated] = await Promise.all([
    CdrRecord.updateMany({ allocationStatus: { $exists: false }, matched: true }, { $set: { allocationStatus: "ALLOCATED" } }),
    CdrRecord.updateMany(
      { allocationStatus: { $exists: false }, matched: { $ne: true } },
      {
        $set: {
          allocationStatus: "UNALLOCATED",
          unallocatedReasonCode: "CUSTOMER_ACCOUNT_NOT_FOUND",
          unallocatedReason: "Not matched to a customer when originally uploaded.",
        },
      }
    ),
  ]);

  // Usage is now unique per (customer, account, month). The original
  // { customer, periodMonth } unique index would block a second account's
  // usage for the same month, so it is dropped (index only — no data).
  let droppedLegacyUsageIndex = false;
  try {
    const indexes = await UsageRecord.collection.indexes();
    if (indexes.some((i) => i.name === "customer_1_periodMonth_1")) {
      await UsageRecord.collection.dropIndex("customer_1_periodMonth_1");
      droppedLegacyUsageIndex = true;
    }
  } catch (err) {
    log(`Could not drop legacy usage index: ${err instanceof Error ? err.message : String(err)}`);
  }
  // createIndexes only adds the schema's indexes; it never drops anything.
  await UsageRecord.createIndexes().catch((err: unknown) =>
    log(`UsageRecord index creation warning: ${err instanceof Error ? err.message : String(err)}`)
  );

  log(
    `Backfilled account links — invoices ${totals.invoices}, subscriptions ${totals.subscriptions}, usage ${totals.usage}, CDR rows ${totals.cdrRecords}, charge rows ${totals.chargeRecords}; allocation status set on ${allocated.modifiedCount + unallocated.modifiedCount} legacy CDR rows; legacy usage index dropped: ${droppedLegacyUsageIndex}`
  );
  return { ...totals, legacyCdrStatuses: allocated.modifiedCount + unallocated.modifiedCount, droppedLegacyUsageIndex };
}
