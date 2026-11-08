import type { ReactNode } from "react";
import { getPortalContext } from "@/lib/accounts/access";
import { requireRole } from "@/lib/auth/dal";
import { PortalShell } from "@/components/portal/PortalShell";
import { getCustomerSupportNotifications } from "@/lib/support/unread";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  // The layout blocks every first page load (the loading skeleton lives inside
  // it) and re-runs on every router.refresh(), including the live device
  // pages' polling. So it only loads what the shell needs right away, in
  // parallel. Device alerts are NOT loaded here: they need the full terminal
  // pipeline (SLASH API + database), and the alert bell fetches them itself
  // from /api/portal/notifications as soon as the page is up.
  const user = await requireRole(["CUSTOMER"], "/admin");
  const [ctx, supportNotifications] = await Promise.all([
    getPortalContext(),
    user.customerProfileId
      ? getCustomerSupportNotifications(user.customerProfileId)
      : Promise.resolve({ unreadCount: 0, tickets: [] }),
  ]);

  return (
    <PortalShell
      user={ctx.user}
      companyLabel={ctx.profile.company || ctx.profile.name}
      accounts={ctx.accounts.map((a) => ({ id: a.id, accountNumber: a.accountNumber, name: a.name, status: a.status }))}
      selectedAccountId={ctx.account?.id ?? null}
      trackingEnabled={ctx.features.tracking}
      supportNotifications={supportNotifications}
    >
      {children}
    </PortalShell>
  );
}
