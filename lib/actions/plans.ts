"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { ServicePlan } from "@/models/ServicePlan";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { servicePlanSchema } from "@/lib/validations/plan";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function savePlanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const id = str(formData, "id");

  const raw = {
    id: id || undefined,
    name: str(formData, "name"),
    provider: str(formData, "provider"),
    planType: str(formData, "planType") || "DATA",
    monthlyPrice: str(formData, "monthlyPrice"),
    currency: str(formData, "currency") || "USD",
    dataAllowanceGB: str(formData, "dataAllowanceGB") || null,
    voiceMinutes: str(formData, "voiceMinutes") || null,
    smsCount: str(formData, "smsCount") || null,
    overageRatePerGB: str(formData, "overageRatePerGB") || "0",
    overageRatePerMin: str(formData, "overageRatePerMin") || "0",
    speedMbps: str(formData, "speedMbps") || null,
    sharedRatio: str(formData, "sharedRatio"),
    isActive: formData.get("isActive") === "on",
  };

  const parsed = servicePlanSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();

  const { id: planId, ...data } = parsed.data;

  if (planId) {
    const plan = await ServicePlan.findByIdAndUpdate(planId, data, { new: true });
    if (!plan) return { error: "Plan not found." };
    await ActivityLog.create({ actor: admin.id, action: "PLAN_UPDATED", meta: { planId, name: plan.name } });
  } else {
    const plan = await ServicePlan.create(data);
    await ActivityLog.create({ actor: admin.id, action: "PLAN_CREATED", meta: { planId: plan._id.toString(), name: plan.name } });
  }

  revalidatePath("/admin/plans");
  return { success: planId ? "Plan updated." : "Plan created." };
}

export async function togglePlanActiveAction(planId: string, isActive: boolean): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const plan = await ServicePlan.findByIdAndUpdate(planId, { isActive }, { new: true });
  if (!plan) return { error: "Plan not found." };

  await ActivityLog.create({
    actor: admin.id,
    action: "PLAN_UPDATED",
    meta: { planId, isActive },
  });

  revalidatePath("/admin/plans");
  return { success: isActive ? "Plan activated." : "Plan deactivated." };
}

export async function deletePlanAction(planId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete plans." };

  await connectDB();

  const { Subscription } = await import("@/models/Subscription");
  const inUse = await Subscription.exists({ plan: planId, status: "ACTIVE" });
  if (inUse) {
    return { error: "This plan has active subscribers and can't be deleted. Deactivate it instead." };
  }

  const plan = await ServicePlan.findByIdAndDelete(planId);
  if (!plan) return { error: "Plan not found." };

  await ActivityLog.create({ actor: admin.id, action: "PLAN_UPDATED", meta: { planId, deleted: true } });

  revalidatePath("/admin/plans");
  return { success: "Plan deleted." };
}
