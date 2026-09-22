"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { selectPortalAccountAction } from "@/lib/actions/portalAccount";
import type { PortalAccountOption } from "@/lib/types/portal";

function optionLabel(a: PortalAccountOption) {
  const suffix = a.status === "ACTIVE" ? "" : ` (${a.status.toLowerCase()})`;
  return `${a.accountNumber}${a.name ? ` · ${a.name}` : ""}${suffix}`;
}

// Switches every portal page to another of the user's Customer Accounts. The
// server validates the choice; with a single account this renders a plain
// label instead of a dropdown.
export function AccountSelector({
  accounts,
  selectedId,
}: {
  accounts: PortalAccountOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  if (accounts.length === 0) {
    return <p className="text-sm text-text-secondary">No account assigned</p>;
  }

  if (accounts.length === 1) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Building2 className="size-3.5 text-text-muted" />
        Account <span className="font-mono font-medium text-text-primary">{accounts[0].accountNumber}</span>
      </p>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary">
      <span className="hidden sm:inline">Account</span>
      <span className="relative">
        <select
          aria-label="Customer Account"
          value={selected?.id ?? ""}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value;
            startTransition(async () => {
              const res = await selectPortalAccountAction(id);
              if (res?.error) toast.error(res.error);
              router.refresh();
            });
          }}
          className="h-9 max-w-[220px] rounded-lg border border-line bg-surface-raised pl-2.5 pr-8 font-mono text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/40 sm:max-w-[280px]"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {optionLabel(a)}
            </option>
          ))}
        </select>
        {pending && <Loader2 className="absolute right-7 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-text-muted" />}
      </span>
    </label>
  );
}
