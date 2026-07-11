import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  return <AdminShell user={user}>{children}</AdminShell>;
}
