import "server-only";
import { CustomerAccount } from "@/models/CustomerAccount";
import { getVessel } from "@/lib/starlink/vessels";
import { StarlinkApiError, describeStarlinkError } from "@/lib/starlink/client";

/**
 * A vessel may belong to only one account, and must exist in the SLASH tenant.
 * If SLASH is unreachable the link is still allowed (the admin may be setting
 * up ahead of time) — only a definite "not found" blocks it.
 */
export async function validateVesselIds(vesselIds: string[], excludeAccountId?: string): Promise<string | null> {
  if (vesselIds.length === 0) return null;
  const taken = await CustomerAccount.findOne({
    starlinkVesselIds: { $in: vesselIds },
    ...(excludeAccountId ? { _id: { $ne: excludeAccountId } } : {}),
  })
    .select("accountNumber starlinkVesselIds")
    .lean();
  if (taken) {
    const clash = vesselIds.find((v) => taken.starlinkVesselIds.includes(v));
    return `Vessel ${clash} is already linked to account ${taken.accountNumber}.`;
  }
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of vesselIds) {
    const clean = id.trim();
    if (!UUID_REGEX.test(clean)) {
      return `Invalid Starlink Vessel ID format "${id}". A Vessel ID must be a valid 36-character UUID (e.g. 019ff593-6557-785c-ac33-36d11b7f301c).`;
    }
    try {
      await getVessel(clean);
    } catch (err) {
      if (err instanceof StarlinkApiError && (err.status === 404 || err.status === 400)) {
        return `Vessel ID "${id}" was not found in the Starlink/SLASH API. Check the ID in the SLASH dashboard.`;
      }
      console.warn(`[accounts] could not verify vessel ${id}: ${describeStarlinkError(err)}`);
    }
  }
  return null;
}

