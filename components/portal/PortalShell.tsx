"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { LayoutDashboard, Receipt, Wifi, BarChart3, Satellite, LifeBuoy, User, MapPin, FileDown } from "lucide-react";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { AccountSelector } from "@/components/portal/AccountSelector";
import { PortalAlertBell } from "@/components/portal/PortalAlertBell";
import { usePortalNotifications } from "@/lib/hooks/useCustomerSupportNotifications";
import { logoutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/dal";
import type { PortalAccountOption } from "@/lib/types/portal";
import type { CustomerSupportNotifications } from "@/lib/support/unread";
import type { EnrichedAlert } from "@/lib/terminals/alerts";

function buildNav(trackingEnabled: boolean, unreadSupportCount: number): NavItem[] {
  return [
    { label: "Overview", href: "/portal", icon: LayoutDashboard },
    { label: "My Bills", href: "/portal/bills", icon: Receipt },
    { label: "My Plans", href: "/portal/plans", icon: Wifi },
    { label: "Usage", href: "/portal/usage", icon: BarChart3 },
    { label: "My Devices", href: "/portal/devices", icon: Satellite },
    // Hidden when a Super Admin disables tracking; the page and its data
    // action are also blocked on the server.
    ...(trackingEnabled ? [{ label: "Tracking", href: "/portal/tracking", icon: MapPin }] : []),
    { label: "Reports", href: "/portal/reports", icon: FileDown },
    {
      label: "Support",
      href: "/portal/support",
      icon: LifeBuoy,
      badge: unreadSupportCount > 0 ? unreadSupportCount : undefined,
    },
    { label: "Profile", href: "/portal/profile", icon: User },
  ];
}

export function PortalShell({
  user,
  companyLabel,
  accounts,
  selectedAccountId,
  trackingEnabled,
  supportNotifications,
  initialAlerts = [],
  children,
}: {
  user: CurrentUser;
  companyLabel: string;
  accounts: PortalAccountOption[];
  selectedAccountId: string | null;
  trackingEnabled: boolean;
  supportNotifications: CustomerSupportNotifications;
  initialAlerts?: EnrichedAlert[];
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();
  const notifications = usePortalNotifications({
    support: supportNotifications,
    alerts: initialAlerts,
  });

  return (
    <AppShell
      navItems={buildNav(trackingEnabled, notifications.support.unreadCount)}
      brandLabel="ATHENA"
      brandHref="/portal"
      logoSrc="/athena-logo.png"
      logoClassName="max-h-16 w-auto object-contain"
      onExit={() => startTransition(() => logoutAction())}
      topbar={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-widest text-text-muted">{companyLabel || "Customer Portal"}</p>
            <AccountSelector accounts={accounts} selectedId={selectedAccountId} />
          </div>
          <div className="flex items-center gap-3">
            <PortalAlertBell support={notifications.support} alerts={notifications.alerts} />
            <Link
              href="/portal/profile"
              className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-surface-raised"
              title="Profile & Settings"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight text-text-primary">{user.name}</p>
                <p className="text-xs leading-tight text-text-muted">{user.email}</p>
              </div>
            </Link>
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
