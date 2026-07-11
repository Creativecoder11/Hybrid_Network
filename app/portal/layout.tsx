import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["CUSTOMER"], "/admin");
  return <PortalShell user={user}>{children}</PortalShell>;
}
