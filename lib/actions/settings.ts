"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { settingsSchema } from "@/lib/validations/settings";
import { sendMail } from "@/lib/email/mailer";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function updateSettingsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can change global settings." };

  const parsed = settingsSchema.safeParse({
    companyName: str(formData, "companyName"),
    companyLegalName: str(formData, "companyLegalName"),
    companyAbn: str(formData, "companyAbn"),
    companyAddress: str(formData, "companyAddress"),
    companyEmail: str(formData, "companyEmail"),
    companyPhone: str(formData, "companyPhone"),
    companyWebsite: str(formData, "companyWebsite"),
    paymentInstructions: String(formData.get("paymentInstructions") ?? "").trim(),
    currency: str(formData, "currency"),
    taxLabel: str(formData, "taxLabel"),
    taxRate: str(formData, "taxRate"),
    invoicePrefix: str(formData, "invoicePrefix"),
    timezone: str(formData, "timezone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  await Settings.findOneAndUpdate(
    { key: "GLOBAL" },
    { $set: { ...parsed.data, companyAbn: parsed.data.companyAbn.replace(/\s+/g, "") } },
    { upsert: true }
  );

  await ActivityLog.create({ actor: admin.id, action: "SETTINGS_UPDATED", meta: parsed.data });

  revalidatePath("/admin/settings");
  return { success: "Settings saved." };
}

export async function testSmtpAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can test SMTP settings." };

  const to = str(formData, "testEmail") || admin.email;

  try {
    const result = await sendMail({
      to,
      subject: "Hybrid Networks — SMTP test email",
      html: `<p>This is a test email from your Hybrid Networks Portal settings page.</p>`,
    });
    if (result.devMode) {
      return {
        success:
          "SMTP isn't configured — check the server console/logs, the test email was logged instead of sent.",
      };
    }
    return { success: `Test email sent to ${to}.` };
  } catch (err) {
    console.error("SMTP test failed", err);
    return { error: "Failed to send test email. Check your SMTP settings and try again." };
  }
}

/**
 * Super Admin feature controls for the customer portal. Enforced server-side
 * (lib/portal/features.ts) — customers cannot turn these back on.
 */
export async function setPortalFeatureAction(
  feature: "deviceLocation" | "tracking",
  enabled: boolean
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can change customer portal features." };
  if (feature !== "deviceLocation" && feature !== "tracking") return { error: "Unknown feature." };

  await connectDB();
  const field = feature === "deviceLocation" ? "featureDeviceLocation" : "featureTracking";
  const before = await Settings.findOneAndUpdate(
    { key: "GLOBAL" },
    { $set: { [field]: Boolean(enabled) } },
    { upsert: true, returnDocument: "before" }
  ).lean();

  await ActivityLog.create({
    actor: admin.id,
    action: feature === "deviceLocation" ? "FEATURE_LOCATION_CHANGED" : "FEATURE_TRACKING_CHANGED",
    meta: { from: before ? before[field] !== false : true, to: Boolean(enabled) },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/portal", "layout");
  const label = feature === "deviceLocation" ? "Device location" : "Tracking";
  return { success: `${label} ${enabled ? "enabled" : "disabled"} for all customers.` };
}
