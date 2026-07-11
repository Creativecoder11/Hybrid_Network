"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/Select";
import { updateTicketStatusAction } from "@/lib/actions/support";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export function AdminTicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: string;
  status: (typeof STATUSES)[number];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(newStatus: (typeof STATUSES)[number]) {
    setPending(true);
    const result = await updateTicketStatusAction(ticketId, newStatus);
    setPending(false);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Status updated.");
      router.refresh();
    }
  }

  return (
    <div>
      <Select
        value={status}
        disabled={pending}
        onChange={(e) =>
          handleChange(e.target.value as (typeof STATUSES)[number])
        }
        className="w-40"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </Select>
    </div>
  );
}
