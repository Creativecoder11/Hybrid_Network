"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Wifi,
  Gauge,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Satellite,
  Radio,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { UsageDonut } from "@/components/portal/UsageDonut";
import { PayNowModal } from "@/components/portal/PayNowModal";
import { TerminalStatusDot } from "@/components/portal/TerminalStatusDot";
import { formatCurrency, formatDate, formatDateTime, formatPeriodMonth, daysUntil } from "@/lib/utils/format";
import type {
  PortalActivityRow,
  PortalInvoiceRow,
  PortalPaymentInfo,
  PortalPlanInfo,
  PortalUsageInfo,
  PortalTerminalSummary,
} from "@/lib/types/portal";

const STATUS_TONE: Record<PortalInvoiceRow["status"], "green" | "amber" | "red" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "amber",
  DUE: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELLED: "neutral",
};

type LiveUsage = {
  totalGB: number;
  allowanceGB: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  lastUpdatedAt: string | null;
};

function activityMeta(action: string, meta: Record<string, unknown>): { icon: typeof Wifi; tone: string; text: ReactNode } {
  const invoiceNumber = typeof meta.invoiceNumber === "string" ? meta.invoiceNumber : null;
  const ticketNumber = typeof meta.ticketNumber === "string" ? meta.ticketNumber : null;
  const paymentMethod = typeof meta.paymentMethod === "string" ? meta.paymentMethod : null;
  const status = typeof meta.status === "string" ? meta.status : null;

  if (action === "INVOICE_PAID") {
    return {
      icon: CheckCircle2,
      tone: "bg-accent-green/15 text-accent-green",
      text: (
        <>
          Invoice <span className="font-medium text-accent-green">{invoiceNumber ?? ""}</span> paid
          {paymentMethod ? ` via ${paymentMethod}` : ""}
        </>
      ),
    };
  }
  if (action === "INVOICE_SENT" || action === "INVOICE_CREATED") {
    return {
      icon: FileText,
      tone: "bg-accent-blue/15 text-accent-blue",
      text: (
        <>
          Invoice <span className="font-medium text-accent-blue">{invoiceNumber ?? ""}</span> issued
        </>
      ),
    };
  }
  if (action === "TICKET_CREATED" || action === "TICKET_REPLIED" || action === "TICKET_STATUS_CHANGED") {
    const verb = action === "TICKET_CREATED" ? "opened" : action === "TICKET_STATUS_CHANGED" ? (status?.toLowerCase() ?? "updated") : "updated";
    return {
      icon: LifeBuoy,
      tone: "bg-amber/15 text-amber",
      text: (
        <>
          Support ticket <span className="font-medium text-amber">{ticketNumber ?? ""}</span> {verb}
        </>
      ),
    };
  }
  if (action === "PLAN_CHANGED") {
    return { icon: Wifi, tone: "bg-accent-blue/15 text-accent-blue", text: "Service plan changed" };
  }
  return {
    icon: Radio,
    tone: "bg-text-muted/15 text-text-secondary",
    text: action.replace(/_/g, " ").toLowerCase(),
  };
}

function cycleLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "Current billing cycle";
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function daysElapsed(start: string | null): number {
  if (!start) return 0;
  const ms = Date.now() - new Date(start).getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export function OverviewClient({
  customerName,
  accountNumber,
  payment,
  plan,
  usage,
  liveUsage,
  periodMonth,
  terminalSummary,
  latestBills,
  activity,
}: {
  customerName: string;
  accountNumber: string;
  payment: PortalPaymentInfo | null;
  plan: PortalPlanInfo | null;
  usage: PortalUsageInfo | null;
  liveUsage: LiveUsage | null;
  periodMonth: string;
  terminalSummary: PortalTerminalSummary;
  latestBills: PortalInvoiceRow[];
  activity: PortalActivityRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [payOpen, setPayOpen] = useState(false);
  const dueInDays = payment ? daysUntil(payment.dueDate) : null;
  const firstName = (customerName || "").trim().split(/\s+/)[0] || "Customer";

  function updatePeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("period", value.replace("-", ""));
    else params.delete("period");
    router.push(`${pathname}?${params.toString()}`);
  }

  const periodInputValue = periodMonth ? `${periodMonth.slice(0, 4)}-${periodMonth.slice(4, 6)}` : "";
  const maxMbps = plan?.speedMbps ?? 0;
  const avgMbps = terminalSummary?.avgThroughputMbps ?? null;
  const speedPct = maxMbps > 0 && avgMbps !== null ? Math.min(100, (avgMbps / maxMbps) * 100) : 0;
  const terminals = terminalSummary?.terminals ?? [];
  const offlineCount = terminals.filter((t) => t.onlineStatus === "OFFLINE").length;
  const unknownCount = terminals.filter((t) => t.onlineStatus === "UNKNOWN").length;

  const usedGB = liveUsage ? liveUsage.totalGB : (usage?.volumeDataGB ?? 0);
  const allowanceGB = liveUsage ? liveUsage.allowanceGB : (plan?.dataAllowanceGB ?? null);
  const dailyAverageGB = liveUsage
    ? Math.round((liveUsage.totalGB / daysElapsed(liveUsage.cycleStart)) * 10) / 10
    : (usage?.dailyAverageGB ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">
          Welcome back, <span className="text-accent-green">{firstName}</span>
        </p>
        <p className="text-sm text-text-muted">
          Account <span className="font-mono text-text-secondary">{accountNumber}</span> at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-green/80 to-accent-blue/90 p-5 text-white lg:col-span-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">Amount Due</p>
            {dueInDays !== null && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                {dueInDays >= 0 ? `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}` : `${-dueInDays} day${-dueInDays === 1 ? "" : "s"} overdue`}
              </span>
            )}
          </div>
          {payment ? (
            <>
              <p className="mt-2 text-3xl font-bold">{formatCurrency(payment.total, payment.currency)}</p>
              <p className="mt-1 text-xs text-white/80">
                Invoice {payment.invoiceNumber} · {formatPeriodMonth(payment.periodMonth)} · due {formatDate(payment.dueDate)}
              </p>
              {payment.outstandingCount > 1 && (
                <p className="mt-1 text-xs font-medium text-white">
                  {payment.outstandingCount} unpaid bills · {formatCurrency(payment.outstandingTotal, payment.currency)} total outstanding
                </p>
              )}
              <div className="mt-4">
                <Button onClick={() => setPayOpen(true)} className="bg-white text-accent-blue-strong hover:bg-white/90">
                  Pay Now
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-white/90">You&apos;re all caught up — no outstanding bills on this account.</p>
          )}
        </div>

        <Card className="flex flex-col p-5">
          {plan ? (
            <>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                  <Wifi className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{plan.planName}</p>
                  <p className="text-xs text-text-muted">
                    {plan.sharedRatio ? <span className="text-accent-green">{plan.sharedRatio} shared</span> : plan.provider}
                  </p>
                </div>
              </div>
              {maxMbps > 0 && (
                <div className="mt-4">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-blue"
                      style={{ width: `${Math.max(4, speedPct)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-text-muted">
                    <span>{avgMbps === null ? "Live throughput not available" : `${avgMbps.toFixed(0)} Mbps live downlink`}</span>
                    <span>{maxMbps} Mbps max</span>
                  </div>
                </div>
              )}
              <div className="mt-auto pt-4">
                <div className="-mx-5 -mb-5 flex items-center justify-between rounded-b-2xl bg-[#303438] px-5 py-3 text-xs">
                  <span className="text-text-muted">Static IP:</span>
                  <span className="font-mono font-medium text-text-primary">{plan.staticIp || "--"}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col justify-center">
              <p className="text-sm text-text-muted">No Hybrid Networks plan is recorded on this account.</p>
              <Link href="/portal/plans" className="mt-2 text-xs font-medium text-accent-blue hover:underline">
                View Starlink service plan
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Connection Status</p>
            <Link href="/portal/devices" className="text-xs font-medium text-accent-blue hover:underline">
              Devices
            </Link>
          </div>
          {terminalSummary.totalCount === 0 ? (
            <p className="py-4 text-xs text-text-muted">No terminals are linked to this account yet. Contact support to link a device.</p>
          ) : (
            <>
              <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                {terminalSummary.terminals.map((t) => (
                  <Link
                    key={t.id}
                    href={`/portal/devices/${encodeURIComponent(t.id)}`}
                    title={t.statusReason}
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-surface-raised transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">{t.name}</span>
                        <TerminalStatusDot status={t.onlineStatus} />
                      </div>
                      <span className="block truncate text-[11px] text-text-muted">
                        {t.lastSeenAt ? `Last seen ${formatDateTime(t.lastSeenAt)}` : t.statusReason}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
              <p className="mt-3 border-t border-line-soft pt-3 text-xs text-text-muted">
                {terminalSummary.activeCount} of {terminalSummary.totalCount} online
                {offlineCount > 0 ? ` · ${offlineCount} offline` : ""}
                {unknownCount > 0 ? ` · ${unknownCount} status unavailable` : ""}
              </p>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-text-primary">{liveUsage ? "Data Usage This Cycle" : "Usage This Month"}</p>
              <p className="text-xs text-text-muted">
                {liveUsage
                  ? `${cycleLabel(liveUsage.cycleStart, liveUsage.cycleEnd)} · live from Starlink${liveUsage.lastUpdatedAt ? `, updated ${formatDateTime(liveUsage.lastUpdatedAt)}` : ""}`
                  : `${formatPeriodMonth(periodMonth)} · from rated CDR records`}
              </p>
            </div>
            {!liveUsage && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Period:</span>
                <input
                  type="month"
                  value={periodInputValue}
                  onChange={(e) => updatePeriod(e.target.value)}
                  className="h-9 rounded-lg border border-line bg-surface-raised px-2.5 text-xs text-text-primary"
                />
              </div>
            )}
          </div>
          {!liveUsage && !usage ? (
            <p className="py-8 text-center text-sm text-text-muted">No usage data available for this period.</p>
          ) : (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex justify-center sm:justify-start">
                <UsageDonut usedGB={usedGB} allowanceGB={allowanceGB} />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                    <Gauge className="size-4" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-text-primary">{usedGB.toFixed(1)} GB</p>
                    <p className="text-xs text-text-muted">Data Used</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                    <Clock className="size-4" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-text-primary">{dailyAverageGB.toFixed(1)} GB</p>
                    <p className="text-xs text-text-muted">Daily average</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                    <Satellite className="size-4" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-text-primary">{String(terminalSummary.totalCount).padStart(2, "0")}</p>
                    <p className="text-xs text-text-muted">Terminals</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-green/15 text-accent-green">
                    <Radio className="size-4" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-text-primary">{String(terminalSummary.activeCount).padStart(2, "0")}</p>
                    <p className="text-xs text-text-muted">Online now</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-1">
          <p className="mb-3 text-sm font-semibold text-text-primary">Recent Activity</p>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">No recent activity.</p>
          ) : (
            <div className="space-y-1">
              {activity.map((a) => {
                const { icon: Icon, tone, text } = activityMeta(a.action, a.meta);
                return (
                  <div key={a.id} className="flex items-start gap-3 border-b border-line-soft py-2.5 last:border-0">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                      <Icon className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-sm text-text-primary">{text}</p>
                      <p className="text-xs text-text-muted">{formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
              <FileText className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-text-primary">Latest Bills</p>
              <p className="text-xs text-text-muted">Most recent invoices for account {accountNumber}</p>
            </div>
          </div>
          <Link href="/portal/bills" className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline">
            View All <ArrowRight className="size-3" />
          </Link>
        </div>
        {latestBills.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-muted">No invoices available.</p>
        ) : (
          <div className="divide-y divide-line-soft">
            {latestBills.map((b) => (
              <Link
                key={b.id}
                href={`/portal/bills/${b.id}`}
                className="flex flex-col gap-2 py-3.5 hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {formatPeriodMonth(b.periodMonth)} <span className="font-normal text-text-muted">· {b.invoiceNumber}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    Due: {formatDate(b.dueDate)} · Issued: {formatDate(b.issueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                  <span className="text-lg font-bold text-accent-green">{formatCurrency(b.total, b.currency)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {payOpen && payment && <PayNowModal payment={payment} onClose={() => setPayOpen(false)} />}
    </div>
  );
}
