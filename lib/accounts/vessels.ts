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
  for (const id of vesselIds) {
    try {
      await getVessel(id);
    } catch (err) {
      if (err instanceof StarlinkApiError && (err.status === 404 || err.status === 400)) {
        return `Vessel ID "${id}" was not found in the SLASH API. Check the ID in the SLASH dashboard.`;
      }
      console.warn(`[accounts] could not verify vessel ${id}: ${describeStarlinkError(err)}`);
    }
  }
  return null;
}

