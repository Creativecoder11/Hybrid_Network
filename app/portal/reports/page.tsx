import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { PortalReportsClient } from "@/components/portal/PortalReportsClient";

export const metadata: Metadata = {
  title: "Reports | Hybrid Networks Portal",
};

export default async function PortalReportsPage() {
  await requireRole(["CUSTOMER"], "/admin");
  return <PortalReportsClient />;
}
