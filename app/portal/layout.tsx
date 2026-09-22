import type { ReactNode } from "react";
import { getPortalContext } from "@/lib/accounts/access";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await getPortalContext();
  return (
    <PortalShell
      user={ctx.user}
      companyLabel={ctx.profile.company || ctx.profile.name}
      accounts={ctx.accounts.map((a) => ({ id: a.id, accountNumber: a.accountNumber, name: a.name, status: a.status }))}
      selectedAccountId={ctx.account?.id ?? null}
      trackingEnabled={ctx.features.tracking}
    >
      {children}
    </PortalShell>
  );
}
