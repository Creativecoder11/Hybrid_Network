import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { getUnreadTicketCount } from "@/lib/support/unread";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  const unreadSupportCount = await getUnreadTicketCount();
  return (
    <AdminShell user={user} unreadSupportCount={unreadSupportCount}>
      {children}
    </AdminShell>
  );
}
