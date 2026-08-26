import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { ReportsPageClient } from "@/components/admin/ReportsPageClient";

export const metadata: Metadata = {
  title: "Reports | Hybrid Networks Admin",
};

export default async function AdminReportsPage() {
  await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  return <ReportsPageClient />;
}
