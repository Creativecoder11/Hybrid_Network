import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { getCurrentUser } from "@/lib/auth/dal";
import { SettingsPageClient } from "@/components/admin/SettingsPageClient";

export const metadata: Metadata = {
  title: "Settings | Hybrid Networks Admin",
};

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "SUPER_ADMIN") redirect("/admin");

  await connectDB();
  let settings = await Settings.findOne({ key: "GLOBAL" }).lean();
  if (!settings) {
    settings = (await Settings.create({ key: "GLOBAL" })).toObject();
  }

  return (
    <SettingsPageClient
      settings={{
        companyName: settings.companyName,
        companyAddress: settings.companyAddress,
        companyEmail: settings.companyEmail,
        companyPhone: settings.companyPhone,
        currency: settings.currency,
        taxLabel: settings.taxLabel,
        taxRate: settings.taxRate,
        invoicePrefix: settings.invoicePrefix,
        timezone: settings.timezone,
      }}
      adminEmail={currentUser.email}
    />
  );
}
