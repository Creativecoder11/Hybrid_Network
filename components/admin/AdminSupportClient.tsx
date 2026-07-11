"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import type { TicketRow } from "@/lib/types/support";

const STATUS_TONE: Record<TicketRow["status"], "blue" | "amber" | "green" | "neutral"> = {
  OPEN: "blue",
  IN_PROGRESS: "amber",
  RESOLVED: "green",
  CLOSED: "neutral",
};

export function AdminSupportClient({ tickets, status }: { tickets: TicketRow[]; status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") params.delete("status");
    else params.set("status", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Support</h1>
          <p className="text-sm text-text-muted">Customer support tickets.</p>
        </div>
        <Select value={status} onChange={(e) => updateStatus(e.target.value)} className="sm:w-44">
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>

      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No support tickets" />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Ticket #</TH>
                <TH>Customer</TH>
                <TH>Subject</TH>
                <TH>Replies</TH>
                <TH>Updated</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {tickets.map((t) => (
                <TR key={t.id}>
                  <TD className="font-mono text-xs">
                    <Link href={`/admin/support/${t.id}`} className="font-medium text-accent-blue hover:underline">
                      {t.ticketNumber}
                    </Link>
                  </TD>
                  <TD>{t.customerName}</TD>
                  <TD className="text-text-primary">{t.subject}</TD>
                  <TD>{t.replyCount}</TD>
                  <TD className="text-text-secondary">{formatDateTime(t.updatedAt)}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
