"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LifeBuoy, Search, Eye, Ticket, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/ui/StatCard";
import { Pagination } from "@/components/ui/Pagination";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { assignTicketAction } from "@/lib/actions/support";
import type { AgentOption, TicketRow, TicketStats } from "@/lib/types/support";

const CATEGORY_LABEL: Record<TicketRow["category"], string> = {
  BILLING: "Billing",
  TECHNICAL: "Technical",
  SERVICE: "Service",
  GENERAL: "General",
};

export function AdminSupportClient({
  tickets,
  total,
  page,
  pageSize,
  status,
  q,
  sort,
  stats,
  agents,
}: {
  tickets: TicketRow[];
  total: number;
  page: number;
  pageSize: number;
  status: string;
  q: string;
  sort: string;
  stats: TicketStats;
  agents: AgentOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(next: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === "" || v === undefined) params.delete(k);
      else params.set(k, String(v));
    }
    if (!("page" in next)) params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== q) updateParams({ q: searchInput });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function toggleAll() {
    if (selected.size === tickets.length) setSelected(new Set());
    else setSelected(new Set(tickets.map((t) => t.id)));
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign(ticketId: string, agentId: string) {
    setAssigning(ticketId);
    const result = await assignTicketAction(ticketId, agentId || null);
    setAssigning(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Ticket assigned.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-2xl font-bold text-text-primary">Support tickets</p>
        <p className="text-sm text-text-muted">View, search, and manage all customer accounts.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open Tickets"
          value={String(stats.openCount)}
          icon="/assets/icons/Icon Container1.svg"
          tone="blue"
          animatedBorder
          sublabel={`${stats.openedTodayCount} opened today`}
        />
        <StatCard
          label="In progress"
          value={String(stats.inProgressCount)}
          icon="/assets/icons/Icon Container1.svg"
          tone="amber"
          animatedBorder
          sublabel={`Across ${stats.inProgressAgentCount} agent${stats.inProgressAgentCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Resolved Today"
          value={String(stats.resolvedTodayCount)}
          icon="/assets/icons/Icon Container1.svg"
          animatedBorder
          tone="green"
          trend={
            stats.resolvedTodayDelta !== 0
              ? { value: `${Math.abs(stats.resolvedTodayDelta)}`, positive: stats.resolvedTodayDelta > 0 }
              : undefined
          }
          sublabel={stats.resolvedTodayDelta !== 0 ? "more than yesterday" : "Same as yesterday"}
        />
        <StatCard
          label="Closed"
          value={String(stats.closedCount)}
          icon="/assets/icons/Icon Container1.svg"
          animatedBorder
          tone="neutral"
          sublabel={`${stats.closedRate.toFixed(1)}% of total base`}
        />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-text-primary">All Tickets</p>
            <p className="text-xs text-text-muted">Search, filter, and update customer account details</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              icon={<Search className="size-4" />}
              placeholder="Search ticket, subject, customer..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="sm:w-64"
            />
            <Select value={sort} onChange={(e) => updateParams({ sort: e.target.value })} className="sm:w-36">
              <option value="date_desc">Newest</option>
              <option value="date_asc">Oldest</option>
            </Select>
            <Select
              value={status}
              onChange={(e) => updateParams({ status: e.target.value })}
              className="sm:w-40"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>
        </div>

        {tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No support tickets found" description="Try adjusting your search or filters." />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>
                    <Checkbox checked={selected.size === tickets.length} onChange={toggleAll} />
                  </TH>
                  <TH>Ticket ID</TH>
                  <TH>Ticket</TH>
                  <TH>Customer Name</TH>
                  <TH>Category</TH>
                  <TH>Status</TH>
                  <TH>Assigned To</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {tickets.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <Checkbox checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} />
                    </TD>
                    <TD className="font-mono text-xs text-text-secondary">
                      <Link href={`/admin/support/${t.id}`} className="font-medium text-accent-blue hover:underline">
                        #{t.ticketNumber}
                      </Link>
                    </TD>
                    <TD className="max-w-xs text-text-primary">{t.subject}</TD>
                    <TD>
                      <p className="text-text-primary">{t.customerName}</p>
                      {t.customerCode && <p className="text-xs text-accent-green">{t.customerCode}</p>}
                    </TD>
                    <TD>
                      <Badge tone="neutral">{CATEGORY_LABEL[t.category]}</Badge>
                    </TD>
                    <TD>
                      <StatusBadge status={t.status} />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Avatar name={t.assignedToName || "Unassigned"} size="sm" />
                        <select
                          value={t.assignedToId}
                          disabled={assigning === t.id}
                          onChange={(e) => handleAssign(t.id, e.target.value)}
                          className="h-8 rounded-lg border border-line bg-surface-raised px-2 text-xs text-text-primary disabled:opacity-50"
                        >
                          <option value="">Unassigned</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end">
                        <Link
                          href={`/admin/support/${t.id}`}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue"
                          aria-label="View ticket"
                        >
                          <Eye className="size-4" />
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => updateParams({ page: p })}
              onPageSizeChange={(size) => updateParams({ pageSize: size, page: 1 })}
              pageSizeOptions={[5, 10, 20, 50]}
            />
          </TableContainer>
        )}
      </div>
    </div>
  );
}
