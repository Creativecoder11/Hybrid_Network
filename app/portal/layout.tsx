import type { ReactNode } from "react";
import { getPortalContext } from "@/lib/accounts/access";
import { PortalShell } from "@/components/portal/PortalShell";
import { getCustomerSupportNotifications } from "@/lib/support/unread";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await getPortalContext();
  const supportNotifications = ctx.user.customerProfileId
    ? await getCustomerSupportNotifications(ctx.user.customerProfileId)
    : { unreadCount: 0, tickets: [] };

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
