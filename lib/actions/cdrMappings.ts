"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import { RetailPlan } from "@/models/RetailPlan";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { cdrIdentifierMappingSchema } from "@/lib/validations/cdrMapping";
import type { ActionState } from "@/lib/actions/customers";

// Product Code management (Admin -> Billing -> Product Codes). Codes are
// matched case-insensitively against CDR rows, so uniqueness of ACTIVE codes
// is enforced case-insensitively here too.

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function activeConflict(identifier: string, excludeId?: string) {
  return CdrIdentifierMapping.findOne({
    identifier: { $regex: `^${escapeRegex(identifier)}$`, $options: "i" },
    isActive: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("identifier")
    .lean();
}

function revalidateProductPages() {
  revalidatePath("/admin/billing/identifier-mapping");
  revalidatePath("/admin/billing/cdr-import");
  revalidatePath("/admin/cdr-upload");
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
    name: str(formData, "name"),
    productType: str(formData, "productType") || "OTHER",
    category: str(formData, "category"),
    description: str(formData, "description"),
    retailPlanId: str(formData, "retailPlanId") || null,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const { id: mappingId, identifier, retailPlanId, isActive, name, productType, category, description } = parsed.data;
  if (mappingId && !mongoose.isValidObjectId(mappingId)) return { error: "Product Code not found." };

  if (retailPlanId) {
    if (!mongoose.isValidObjectId(retailPlanId) || !(await RetailPlan.exists({ _id: retailPlanId }))) {
      return { error: "Retail Plan not found." };
    }
  }

  // Only one ACTIVE entry per code — otherwise the same CDR Product Code could
  // resolve to two different products / prices.
  if (isActive && (await activeConflict(identifier, mappingId))) {
    return { error: `Product Code "${identifier}" is already active. Deactivate the existing entry first.` };
  }

  const fields = { identifier, name, productType, category, description, retailPlan: retailPlanId || null, isActive };

  if (mappingId) {
    const mapping = await CdrIdentifierMapping.findByIdAndUpdate(mappingId, fields, { new: true });
    if (!mapping) return { error: "Product Code not found." };
    await ActivityLog.create({
      actor: admin.id,
      action: "CDR_MAPPING_UPDATED",
      meta: { mappingId, identifier, productType, retailPlanId: retailPlanId || null, isActive },
    });
  } else {
    const mapping = await CdrIdentifierMapping.create({ ...fields, createdBy: admin.id });
    await ActivityLog.create({
      actor: admin.id,
      action: "CDR_MAPPING_CREATED",
      meta: { mappingId: mapping._id.toString(), identifier, productType, retailPlanId: retailPlanId || null },
    });
  }

  revalidateProductPages();
  return { success: mappingId ? "Product Code updated." : "Product Code created." };
}

export async function toggleCdrMappingActiveAction(mappingId: string, isActive: boolean): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(mappingId)) return { error: "Product Code not found." };

  await connectDB();

  const mapping = await CdrIdentifierMapping.findById(mappingId);
  if (!mapping) return { error: "Product Code not found." };

  if (isActive && (await activeConflict(mapping.identifier, mappingId))) {
    return { error: `Product Code "${mapping.identifier}" is already active in another entry.` };
  }

  mapping.isActive = isActive;
  await mapping.save();

  await ActivityLog.create({
    actor: admin.id,
    action: "CDR_MAPPING_UPDATED",
    meta: { mappingId, identifier: mapping.identifier, isActive },
  });

  revalidateProductPages();
  return { success: isActive ? "Product Code activated." : "Product Code deactivated." };
}

export async function deleteCdrMappingAction(mappingId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete Product Codes." };
  if (!mongoose.isValidObjectId(mappingId)) return { error: "Product Code not found." };

  await connectDB();
  const mapping = await CdrIdentifierMapping.findByIdAndDelete(mappingId);
  if (!mapping) return { error: "Product Code not found." };

  await ActivityLog.create({
    actor: admin.id,
    action: "CDR_MAPPING_DELETED",
    meta: { mappingId, identifier: mapping.identifier },
  });

  revalidateProductPages();
  return { success: "Product Code deleted." };
}
