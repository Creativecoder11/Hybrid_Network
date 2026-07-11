"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import Image from "next/image";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

function LogoMark() {
  return (
    <Image
      src="/Hybrid - Logo.svg"
      alt="Logo"
      width={173}
      height={80}
      loading="eager"
      className=""
    />
  );
}

export function AppShell({
  navItems,
  brandLabel,
  brandHref,
  onExit,
  exitLabel = "Exit Portal",
  topbar,
  children,
}: {
  navItems: NavItem[];
  brandLabel: string;
  brandHref: string;
  onExit: () => void;
  exitLabel?: string;
  topbar?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    href === brandHref ? pathname === href : pathname.startsWith(href);

  const navList = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        Main
      </p>
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-lg py-2.5 pl-3 pr-3 text-sm font-medium transition-colors",
              active
                ? "bg-[#181C21] text-accent-green"
                : "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
            )}
          >
            {active && (
              <span className="absolute inset-y-0 left-0.5 w-0.75 rounded-bl-2xl rounded-tl-2xl bg-accent-green" />
            )}
            <Icon className="size-4.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-[#03070C] md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LogoMark />
          {/* <span className="text-sm font-bold tracking-wide text-text-primary">{brandLabel}</span> */}
        </div>
        {navList()}
        <div className="border-t border-line p-3">
          <button
            onClick={onExit}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-red/10 hover:text-red"
          >
            <LogOut className="size-4.5" />
            {exitLabel}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <LogoMark />
                <span className="text-sm font-bold tracking-wide text-text-primary">
                  {brandLabel}
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5 text-text-muted" />
              </button>
            </div>
            {navList(() => setDrawerOpen(false))}
            <div className="border-t border-line p-3">
              <button
                onClick={onExit}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-red/10 hover:text-red"
              >
                <LogOut className="size-4.5" />
                {exitLabel}
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-[#181C21] px-4 py-3 backdrop-blur md:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-raised md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1">{topbar}</div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
