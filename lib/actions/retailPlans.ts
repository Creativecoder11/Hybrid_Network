"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { RetailPlan } from "@/models/RetailPlan";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { retailPlanSchema } from "@/lib/validations/retailPlan";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveRetailPlanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const id = str(formData, "id");

  const raw = {
    id: id || undefined,
    name: str(formData, "name"),
    description: str(formData, "description"),
    pricingMethod: str(formData, "pricingMethod") || "PERCENTAGE_MARKUP",
    markupPercent: str(formData, "markupPercent") || "50",
    fixedPrice: str(formData, "fixedPrice") || "0",
    currency: str(formData, "currency") || "USD",
    isActive: formData.get("isActive") === "on",
  };

  const parsed = retailPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const { id: planId, ...data } = parsed.data;

  if (planId) {
    const plan = await RetailPlan.findByIdAndUpdate(planId, data, { new: true });
    if (!plan) return { error: "Retail Plan not found." };
    await ActivityLog.create({
      actor: admin.id,
      action: "RETAIL_PLAN_UPDATED",
      meta: { planId, name: plan.name },
    });
  } else {
    const plan = await RetailPlan.create({ ...data, createdBy: admin.id });
    await ActivityLog.create({
      actor: admin.id,
      action: "RETAIL_PLAN_CREATED",
      meta: { planId: plan._id.toString(), name: plan.name },
    });
  }

  revalidatePath("/admin/billing/retail-plans");
  return { success: planId ? "Retail Plan updated." : "Retail Plan created." };
}

export async function toggleRetailPlanActiveAction(planId: string, isActive: boolean): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const plan = await RetailPlan.findByIdAndUpdate(planId, { isActive }, { new: true });
  if (!plan) return { error: "Retail Plan not found." };

  await ActivityLog.create({
    actor: admin.id,
    action: "RETAIL_PLAN_UPDATED",
    meta: { planId, isActive },
  });

  revalidatePath("/admin/billing/retail-plans");
  return { success: isActive ? "Plan activated." : "Plan deactivated." };
}

export async function deleteRetailPlanAction(planId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete retail plans." };

  await connectDB();

  const inUse = await CdrIdentifierMapping.exists({ retailPlan: planId, isActive: true });
  if (inUse) {
    return { error: "This plan has active identifier mappings and can't be deleted. Deactivate it instead." };
  }

  const plan = await RetailPlan.findByIdAndDelete(planId);
  if (!plan) return { error: "Retail Plan not found." };

  await ActivityLog.create({
    actor: admin.id,
    action: "RETAIL_PLAN_DELETED",
    meta: { planId, name: plan.name },
  });

  revalidatePath("/admin/billing/retail-plans");
  return { success: "Retail Plan deleted." };
}
