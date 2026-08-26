"use client";

import { useTransition, type ReactNode } from "react";
import { LayoutDashboard, Receipt, Wifi, BarChart3, Satellite, LifeBuoy, User, Bell, MapPin, AlertTriangle, FileDown } from "lucide-react";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/dal";

const NAV: NavItem[] = [
  { label: "Overview", href: "/portal", icon: LayoutDashboard },
  { label: "My Bills", href: "/portal/bills", icon: Receipt },
  { label: "My Plans", href: "/portal/plans", icon: Wifi },
  { label: "Usage", href: "/portal/usage", icon: BarChart3 },
  { label: "My Devices", href: "/portal/devices", icon: Satellite },
  { label: "Tracking", href: "/portal/tracking", icon: MapPin },
  { label: "Alerts", href: "/portal/alerts", icon: AlertTriangle },
  { label: "Reports", href: "/portal/reports", icon: FileDown },
  { label: "Support", href: "/portal/support", icon: LifeBuoy },
  { label: "Profile", href: "/portal/profile", icon: User },
];

export function PortalShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [, startTransition] = useTransition();

  return (
    <AppShell
      navItems={NAV}
      brandLabel="HYBRID NETWORKS"
      brandHref="/portal"
      onExit={() => startTransition(() => logoutAction())}
      topbar={
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Customer Portal</p>
            <p className="text-sm text-text-secondary">{user.customerId}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative flex size-9 items-center justify-center rounded-full border border-line text-text-secondary hover:bg-surface-raised"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight text-text-primary">{user.name}</p>
                <p className="text-xs leading-tight text-text-muted">{user.email}</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
