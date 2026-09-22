import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { getUnreadTicketCount } from "@/lib/support/unread";
import { countOpenCdrAlerts, listOpenCdrAlerts } from "@/lib/cdr/alerts";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  const [unreadSupportCount, cdrAlerts, cdrAlertCount] = await Promise.all([
    getUnreadTicketCount(),
    listOpenCdrAlerts(8),
    countOpenCdrAlerts(),
  ]);
  return (
    <AdminShell user={user} unreadSupportCount={unreadSupportCount} cdrAlerts={cdrAlerts} cdrAlertCount={cdrAlertCount}>
      {children}
    </AdminShell>
  );
}
