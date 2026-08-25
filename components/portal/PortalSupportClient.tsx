"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, LifeBuoy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewTicketModal } from "@/components/portal/NewTicketModal";
import { formatDateTime } from "@/lib/utils/format";
import type { TicketRow } from "@/lib/types/support";

const STATUS_TONE: Record<TicketRow["status"], "blue" | "amber" | "green" | "neutral"> = {
  OPEN: "blue",
  IN_PROGRESS: "amber",
  RESOLVED: "green",
  CLOSED: "neutral",
};

export function PortalSupportClient({ tickets }: { tickets: TicketRow[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-bold text-text-primary">Support</p>
          <p className="text-sm text-text-muted">Get help from our team.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          New Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No support tickets yet"
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              New Ticket
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Link key={t.id} href={`/portal/support/${t.id}`}>
              <Card className="flex items-center justify-between p-4 hover:bg-surface-raised">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{t.subject}</p>
                    <Badge tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {t.ticketNumber} · {formatDateTime(t.updatedAt)} · {t.replyCount} repl
                    {t.replyCount === 1 ? "y" : "ies"}
                  </p>
                </div>
                <ArrowRight className="size-4 text-text-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      {modalOpen && <NewTicketModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
