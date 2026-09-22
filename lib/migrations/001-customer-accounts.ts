import type { Types } from "mongoose";
import { User } from "@/models/User";
import { CustomerAccount, normalizeAccountNumber } from "@/models/CustomerAccount";

// Creates Customer Accounts from the single-account fields that used to live
// directly on each Customer Profile (User.customerCode, plus the
// customerCodes array from an unreleased earlier attempt, and the Starlink
// vessel / ICCID / card-name links). Non-destructive: the legacy fields are
// left in place. Idempotent: a profile that already has accounts is skipped.

type LegacyProfile = {
  _id: Types.ObjectId;
  customerId?: string | null;
  customerCode?: string | null;
  customerCodes?: string[];
  starlinkVesselId?: string | null;
  iccid?: string | null;
  cardName?: string | null;
  createdBy?: Types.ObjectId | null;
};

export async function migrateCustomerAccounts(log: (msg: string) => void) {
  const profiles = (await User.find({ role: "CUSTOMER", customerProfile: null }).lean()) as unknown as LegacyProfile[];

  let created = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (const profile of profiles) {
    const existing = await CustomerAccount.countDocuments({ customer: profile._id });
    if (existing > 0) {
      skipped++;
      continue;
    }

    const codes = Array.from(
      new Set(
        [profile.customerCode ?? "", ...(Array.isArray(profile.customerCodes) ? profile.customerCodes : [])]
          .map((c) => String(c ?? "").trim())
          .filter(Boolean)
      )
    );

    const hasLinks = Boolean(profile.starlinkVesselId || profile.iccid || profile.cardName);
    let usedFallbackNumber = false;
    if (codes.length === 0) {
      if (!hasLinks || !profile.customerId) {
        skipped++;
        continue;
      }
      // The profile has devices/CDR identifiers but never had a Customer Code.
      // Keep those links working under an account numbered with the portal
      // Customer ID; the admin should rename it to the real Customer Code.
      codes.push(profile.customerId);
      usedFallbackNumber = true;
    }

    for (let i = 0; i < codes.length; i++) {
      const accountNumber = codes[i];
      const taken = await CustomerAccount.exists({ accountNumberNormalized: normalizeAccountNumber(accountNumber) });
      if (taken) {
        conflicts.push(`${accountNumber} (profile ${profile._id.toString()})`);
        continue;
      }
      const isPrimary = i === 0;
      await CustomerAccount.create({
        customer: profile._id,
        accountNumber,
        name: "",
        status: "ACTIVE",
        starlinkVesselIds: isPrimary && profile.starlinkVesselId ? [profile.starlinkVesselId] : [],
        iccids: isPrimary && profile.iccid ? [profile.iccid] : [],
        cardName: isPrimary ? (profile.cardName ?? "") : "",
        notes: usedFallbackNumber
          ? "Created automatically during the multi-account migration using the portal Customer ID because this profile had no Customer Code. Rename it to the real Customer Code / Account Number."
          : "",
        createdBy: profile.createdBy ?? null,
      });
      created++;
    }
  }

  if (conflicts.length > 0) log(`Account numbers already in use, not duplicated: ${conflicts.join(", ")}`);
  log(`Customer accounts created: ${created}; profiles skipped: ${skipped}`);
  return { created, skipped, conflicts };
}
