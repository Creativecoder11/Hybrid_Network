"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { replyTicketAction } from "@/lib/actions/support";
import type { ActionState } from "@/lib/actions/customers";
import { formatDateTime } from "@/lib/utils/format";
import type { TicketDetail } from "@/lib/types/support";

const STATUS_TONE: Record<TicketDetail["status"], "blue" | "amber" | "green" | "neutral"> = {
  OPEN: "blue",
  IN_PROGRESS: "amber",
  RESOLVED: "green",
  CLOSED: "neutral",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Send Reply
    </Button>
  );
}

export function TicketThread({
  ticket,
  headerExtra,
}: {
  ticket: TicketDetail;
  headerExtra?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(replyTicketAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-text-primary">{ticket.subject}</h1>
            <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-xs text-text-muted">
            {ticket.ticketNumber} · Opened {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        {headerExtra}
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Avatar name={ticket.customerName} size="sm" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary">{ticket.customerName}</p>
              <p className="text-xs text-text-muted">{formatDateTime(ticket.createdAt)}</p>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{ticket.message}</p>
          </div>
        </div>
      </Card>

      {ticket.replies.map((r, i) => (
        <Card key={i} className={`p-4 ${r.isAdmin ? "border-accent-blue/30 bg-accent-blue/5" : ""}`}>
          <div className="flex items-start gap-3">
            <Avatar name={r.authorName} size="sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{r.authorName}</p>
                {r.isAdmin && <Badge tone="blue">Support Team</Badge>}
                <p className="text-xs text-text-muted">{formatDateTime(r.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-text-secondary">{r.message}</p>
            </div>
          </div>
        </Card>
      ))}

      {ticket.status !== "CLOSED" && (
        <form ref={formRef} action={formAction} className="space-y-2">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <Textarea name="message" placeholder="Write a reply..." rows={3} required />
          {state?.error && <p className="text-xs text-red">{state.error}</p>}
          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      )}
    </div>
  );
}
