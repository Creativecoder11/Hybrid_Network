"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionState } from "@/lib/actions/customers";

export type AccountOption = { id: string; label: string };

// Admin manual action for one unallocated CDR record: allocate it to a
// Customer Account chosen from the list (the Product Code must still be valid).
export function AssignAccountControl({
  recordId,
  accounts,
  onAssign,
}: {
  recordId: string;
  accounts: AccountOption[];
  onAssign: (recordId: string, accountId: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <select
      aria-label="Allocate to Customer Account"
      disabled={pending || accounts.length === 0}
      defaultValue=""
      onChange={async (e) => {
        const accountId = e.target.value;
        if (!accountId) return;
        setPending(true);
        const res = await onAssign(recordId, accountId);
        setPending(false);
        e.target.value = "";
        if (res?.error) toast.error(res.error);
        else {
          toast.success(res?.success ?? "Allocated.");
          router.refresh();
        }
      }}
      className="h-8 max-w-[180px] rounded-lg border border-line bg-surface-raised px-2 text-xs text-text-primary disabled:opacity-50"
    >
      <option value="">{pending ? "Allocating…" : "Allocate to…"}</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label}
        </option>
      ))}
    </select>
  );
}
