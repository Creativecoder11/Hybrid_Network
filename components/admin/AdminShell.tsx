"use client";

import { useTransition, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Wifi,
  UploadCloud,
  Satellite,
  LifeBuoy,
  UserCog,
  Settings as SettingsIcon,
  Bell,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/ui/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/dal";

const BASE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Billing", href: "/admin/billing", icon: Receipt },
  { label: "Service Plans", href: "/admin/plans", icon: Wifi },
  { label: "CDR Upload", href: "/admin/cdr-upload", icon: UploadCloud },
  { label: "Terminals", href: "/admin/terminals", icon: Satellite },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
];

export function AdminShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [, startTransition] = useTransition();

  const navItems: NavItem[] = [
    ...BASE_NAV,
    ...(user.role === "SUPER_ADMIN"
      ? [{ label: "Team", href: "/admin/team", icon: UserCog }]
      : []),
    { label: "Settings", href: "/admin/settings", icon: SettingsIcon },
  ];

  return (
    <AppShell
      navItems={navItems}
      brandLabel="HYBRID NETWORKS"
      brandHref="/admin"
      onExit={() => startTransition(() => logoutAction())}
      topbar={
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Admin Portal</p>
            <p className="text-sm text-text-secondary">
              {user.role === "SUPER_ADMIN" ? "Super Admin" : "Sub Admin"} access
            </p>
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
