import type { Metadata } from "next";
import { getPortalContext } from "@/lib/accounts/access";
import { PortalReportsClient } from "@/components/portal/PortalReportsClient";

export const metadata: Metadata = {
  title: "Reports | Hybrid Networks Portal",
};

export default async function PortalReportsPage() {
  const ctx = await getPortalContext();
  return <PortalReportsClient accountNumber={ctx.account?.accountNumber ?? null} locationEnabled={ctx.features.deviceLocation} />;
}
