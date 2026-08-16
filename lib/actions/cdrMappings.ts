"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import { RetailPlan } from "@/models/RetailPlan";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { cdrIdentifierMappingSchema } from "@/lib/validations/cdrMapping";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveCdrMappingAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = cdrIdentifierMappingSchema.safeParse({
    id: str(formData, "id") || undefined,
    identifier: str(formData, "identifier"),
    retailPlanId: str(formData, "retailPlanId"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();

  const plan = await RetailPlan.findById(parsed.data.retailPlanId);
  if (!plan) return { error: "Retail Plan not found." };

  const { id: mappingId, identifier, retailPlanId, isActive } = parsed.data;

  // Only one ACTIVE mapping per identifier is allowed — otherwise the same
  // CDR identifier could silently resolve to two different Retail Plans.
  if (isActive) {
    const conflict = await CdrIdentifierMapping.findOne({
      identifier,
      isActive: true,
      ...(mappingId ? { _id: { $ne: mappingId } } : {}),
    });
    if (conflict) {
      return {
        error: `"${identifier}" is already actively mapped to another Retail Plan. Deactivate that mapping first.`,
      };
    }
  }

  if (mappingId) {
    const mapping = await CdrIdentifierMapping.findByIdAndUpdate(
      mappingId,
      { identifier, retailPlan: retailPlanId, isActive },
      { new: true }
    );
    if (!mapping) return { error: "Mapping not found." };
    await ActivityLog.create({
      actor: admin.id,
      action: "CDR_MAPPING_UPDATED",
      meta: { mappingId, identifier },
    });
  } else {
    const mapping = await CdrIdentifierMapping.create({
      identifier,
      retailPlan: retailPlanId,
      isActive,
      createdBy: admin.id,
    });
    await ActivityLog.create({
      actor: admin.id,
      action: "CDR_MAPPING_CREATED",
      meta: { mappingId: mapping._id.toString(), identifier },
    });
  }

  revalidatePath("/admin/billing/identifier-mapping");
  return { success: mappingId ? "Mapping updated." : "Mapping created." };
}

export async function toggleCdrMappingActiveAction(mappingId: string, isActive: boolean): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();

  const mapping = await CdrIdentifierMapping.findById(mappingId);
  if (!mapping) return { error: "Mapping not found." };

  if (isActive) {
    const conflict = await CdrIdentifierMapping.findOne({
      identifier: mapping.identifier,
      isActive: true,
      _id: { $ne: mappingId },
    });
    if (conflict) {
      return { error: `"${mapping.identifier}" is already actively mapped to another Retail Plan.` };
    }
  }

  mapping.isActive = isActive;
  await mapping.save();

  await ActivityLog.create({
    actor: admin.id,
    action: "CDR_MAPPING_UPDATED",
    meta: { mappingId, isActive },
  });

  revalidatePath("/admin/billing/identifier-mapping");
  return { success: isActive ? "Mapping activated." : "Mapping deactivated." };
}

export async function deleteCdrMappingAction(mappingId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete mappings." };

  await connectDB();
  const mapping = await CdrIdentifierMapping.findByIdAndDelete(mappingId);
  if (!mapping) return { error: "Mapping not found." };

  await ActivityLog.create({
    actor: admin.id,
    action: "CDR_MAPPING_DELETED",
    meta: { mappingId, identifier: mapping.identifier },
  });

  revalidatePath("/admin/billing/identifier-mapping");
  return { success: "Mapping deleted." };
}
