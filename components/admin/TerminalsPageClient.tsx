"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  Satellite,
  Wifi,
  WifiOff,
  AlertTriangle,
  Ban,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import {
  TableContainer,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import type {
  TerminalRecord,
  TerminalStatus,
  FaultStatus,
} from "@/lib/terminals/types";

const STATUS_TONE: Record<
  TerminalStatus,
  "green" | "amber" | "red" | "neutral" | "blue"
> = {
  ACTIVE: "green",
  INACTIVE: "neutral",
  DEACTIVATED: "neutral",
  SUSPENDED: "amber",
  PENDING_ACTIVATION: "blue",
  CANCELLED: "red",
};

export function TerminalsPageClient({
  terminals,
  q,
  status,
  faultStatus,
  stats,
}: {
  terminals: TerminalRecord[];
  q: string;
  status: TerminalStatus | "ALL";
  faultStatus: FaultStatus | "ANY";
  stats: {
    total: number;
    online: number;
    openFaults: number;
    suspended: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === "ALL" || v === "ANY") params.delete(k);
      else params.set(k, v);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold ">Terminals</p>
          <p className="text-sm">
            Live fleet inventory, health, and remote management. Customers linked to a
            Starlink vessel show real SLASH API data; everyone else shows simulated data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/terminals/export?format=csv">
            <button className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised">
              <Download className="size-3.5" /> CSV
            </button>
          </a>
          <a href="/api/admin/terminals/export?format=json">
            <button className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised">
              <Download className="size-3.5" /> JSON
            </button>
          </a>
          <a href="/api/admin/reports/export?type=inventory&format=xlsx">
            <button className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised">
              <Download className="size-3.5" /> Excel
            </button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Terminals"
          value={String(stats.total)}
          icon="/assets/icons/Icon Container2.svg"
          animatedBorder
          tone="blue"
        />
        <StatCard
          label="Online Now"
          value={String(stats.online)}
          icon="/assets/icons/Icon Container2.svg"
          animatedBorder
          tone="green"
        />
        <StatCard
          label="Open Faults"
          value={String(stats.openFaults)}
          icon="/assets/icons/Icon Container2.svg"
          tone="red"
          animatedBorder
        />
        <StatCard
          label="Suspended"
          value={String(stats.suspended)}
          icon="/assets/icons/Icon Container2.svg"
          tone="amber"
          animatedBorder
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            icon={<Search className="size-4" />}
            placeholder="Search by serial, IMEI, ICCID, or customer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div>
          <Select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="sm:w-52"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING_ACTIVATION">Pending Activation</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DEACTIVATED">Deactivated</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <div>
          <Select
            value={faultStatus}
            onChange={(e) => updateParams({ faultStatus: e.target.value })}
            className="sm:w-44"
          >
            <option value="ANY">Any fault status</option>
            <option value="OPEN">Open faults</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="CLEARED">Cleared only</option>
          </Select>
        </div>
      </div>

      {terminals.length === 0 ? (
        <EmptyState
          icon={Satellite}
          title="No terminals found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Terminal</TH>
                <TH>Customer</TH>
                <TH>Model</TH>
                <TH>Status</TH>
                <TH>Signal</TH>
                <TH>Last Seen</TH>
                <TH>Faults</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {terminals.map((t) => {
                const openFaults = t.faults.filter(
                  (f) => f.status === "OPEN",
                ).length;
                return (
                  <TR key={t.id}>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-text-primary">
                          {t.identification.serialNumber}
                        </p>
                        {t.sourceVesselId && (
                          <Badge tone="blue" className="px-1.5 py-0.5 text-[10px]">
                            Live
                          </Badge>
                        )}
                      </div>
                      <p className="font-mono text-xs text-accent-green">
                        {t.identification.iccid}
                      </p>
                    </TD>
                    <TD>
                      {t.activation.assignedCustomerName ?? (
                        <span className="text-text-muted">Unassigned</span>
                      )}
                    </TD>
                    <TD>{t.product.model}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[t.status]}>
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        {t.live.onlineStatus === "ONLINE" ? (
                          <Wifi className="size-3.5 text-accent-green" />
                        ) : (
                          <WifiOff className="size-3.5 text-text-muted" />
                        )}
                        <span className="text-xs">
                          {t.live.onlineStatus === "ONLINE"
                            ? `${t.live.signalStrengthDbm} dBm`
                            : "Offline"}
                        </span>
                      </div>
                    </TD>
                    <TD className="text-text-secondary">
                      {formatDateTime(t.live.lastSeenAt)}
                    </TD>
                    <TD>
                      {openFaults > 0 ? (
                        <Badge tone="red">{openFaults} open</Badge>
                      ) : (
                        <span className="text-xs text-text-muted">None</span>
                      )}
                    </TD>
                    <TD>
                      <Link
                        href={`/admin/terminals/${t.id}`}
                        className="text-xs font-medium text-accent-blue hover:underline"
                      >
                        View
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
