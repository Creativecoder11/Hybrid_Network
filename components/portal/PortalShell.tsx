"use client";

import { useTransition, type ReactNode } from "react";
import { LayoutDashboard, Receipt, Wifi, BarChart3, Satellite, LifeBuoy, User, MapPin, AlertTriangle, FileDown } from "lucide-react";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { AccountSelector } from "@/components/portal/AccountSelector";
import { logoutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/dal";
import type { PortalAccountOption } from "@/lib/types/portal";

function buildNav(trackingEnabled: boolean): NavItem[] {
  return [
    { label: "Overview", href: "/portal", icon: LayoutDashboard },
    { label: "My Bills", href: "/portal/bills", icon: Receipt },
    { label: "My Plans", href: "/portal/plans", icon: Wifi },
    { label: "Usage", href: "/portal/usage", icon: BarChart3 },
    { label: "My Devices", href: "/portal/devices", icon: Satellite },
    // Hidden when a Super Admin disables tracking; the page and its data
    // action are also blocked on the server.
    ...(trackingEnabled ? [{ label: "Tracking", href: "/portal/tracking", icon: MapPin }] : []),
    { label: "Alerts", href: "/portal/alerts", icon: AlertTriangle },
    { label: "Reports", href: "/portal/reports", icon: FileDown },
    { label: "Support", href: "/portal/support", icon: LifeBuoy },
    { label: "Profile", href: "/portal/profile", icon: User },
  ];
}

export function PortalShell({
  user,
  companyLabel,
  accounts,
  selectedAccountId,
  trackingEnabled,
  children,
}: {
  user: CurrentUser;
  companyLabel: string;
  accounts: PortalAccountOption[];
  selectedAccountId: string | null;
  trackingEnabled: boolean;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();

  return (
    <AppShell
      navItems={buildNav(trackingEnabled)}
      brandLabel="HYBRID NETWORKS"
      brandHref="/portal"
      onExit={() => startTransition(() => logoutAction())}
      topbar={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-widest text-text-muted">{companyLabel || "Customer Portal"}</p>
            <AccountSelector accounts={accounts} selectedId={selectedAccountId} />
          </div>
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight text-text-primary">{user.name}</p>
              <p className="text-xs leading-tight text-text-muted">{user.email}</p>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
