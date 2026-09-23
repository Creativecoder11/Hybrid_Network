"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/admin/billing/cdr-import", label: "CDR Uploads" },
  { href: "/admin/billing/cdr-records", label: "CDR Records" },
  { href: "/admin/billing/retail-plans", label: "Retail Plans" },
  { href: "/admin/billing/identifier-mapping", label: "Product Codes" },
];

export function CdrSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-accent-green text-accent-green"
                : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

