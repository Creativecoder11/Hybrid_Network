"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/Select";
import { updateTicketPriorityAction } from "@/lib/actions/support";
import { PRIORITY_LABEL, TICKET_PRIORITIES, type TicketPriority } from "@/lib/support/priority";

export function AdminTicketPriorityControl({ ticketId, priority }: { ticketId: string; priority: TicketPriority }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(next: TicketPriority) {
    setPending(true);
    const result = await updateTicketPriorityAction(ticketId, next);
    setPending(false);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Priority updated.");
      router.refresh();
    }
  }

  return (
    <Select
      value={priority}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value as TicketPriority)}
      className="w-32"
      aria-label="Priority"
    >
      {TICKET_PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABEL[p]}
        </option>
      ))}
    </Select>
  );
}
