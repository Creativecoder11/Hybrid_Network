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
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { UsageDonut } from "@/components/portal/UsageDonut";
import { PayNowModal } from "@/components/portal/PayNowModal";
import { formatCurrency, formatDate, formatPeriodMonth, daysUntil } from "@/lib/utils/format";
import type {
  PortalActivityRow,
  PortalInvoiceRow,
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

function periodRangeLabel(periodMonth: string): string {
  const year = Number(periodMonth.slice(0, 4));
  const month = Number(periodMonth.slice(4, 6));
  if (!year || !month) return "";
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  const lastDay = new Date(year, month, 0).getDate();
  const endDay = isCurrent ? now.getDate() : lastDay;
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date(year, month - 1, 1));
  return `1–${endDay} ${monthName} ${year}`;
}

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
    const planName = typeof meta.planName === "string" ? meta.planName : null;
    return {
      icon: Wifi,
      tone: "bg-accent-blue/15 text-accent-blue",
      text: (
        <>
          Connected to <span className="font-medium text-accent-blue">{planName ?? "a new plan"}</span> plan
        </>
      ),
    };
  }
  if (action === "TERMINAL_STATUS_CHANGED" || action === "TERMINAL_COMMAND") {
    return {
      icon: Satellite,
      tone: "bg-text-muted/15 text-text-secondary",
      text: "Terminal status updated",
    };
  }
  return {
    icon: Radio,
    tone: "bg-text-muted/15 text-text-secondary",
    text: action.replace(/_/g, " ").toLowerCase(),
  };
}

export function OverviewClient({
  customerName,
  currentBill,
  plan,
  usage,
  periodMonth,
  terminalSummary,
  latestBills,
  activity,
}: {
  customerName: string;
  currentBill: PortalInvoiceRow | null;
  plan: PortalPlanInfo | null;
  usage: PortalUsageInfo | null;
  periodMonth: string;
  terminalSummary: PortalTerminalSummary;
  latestBills: PortalInvoiceRow[];
  activity: PortalActivityRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [payOpen, setPayOpen] = useState(false);
  const dueInDays = currentBill ? daysUntil(currentBill.dueDate) : null;
  const firstName = customerName.split(" ")[0];

  function updatePeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("period", value.replace("-", ""));
    else params.delete("period");
    router.push(`${pathname}?${params.toString()}`);
  }

  const periodInputValue = periodMonth ? `${periodMonth.slice(0, 4)}-${periodMonth.slice(4, 6)}` : "";
  const maxMbps = plan?.speedMbps ?? 0;
  const avgMbps = terminalSummary.avgThroughputMbps;
  const speedPct = maxMbps > 0 ? Math.min(100, (avgMbps / maxMbps) * 100) : 0;
  const allOnline = terminalSummary.totalCount > 0 && terminalSummary.activeCount === terminalSummary.totalCount;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">
          Welcome back, <span className="text-accent-green">{firstName}</span>
        </p>
        <p className="text-sm text-text-muted">Here&apos;s what&apos;s been happening with your network today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-green/80 to-accent-blue/90 p-5 text-white lg:col-span-1">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">Current Bill</p>
            {dueInDays !== null && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                {dueInDays >= 0 ? `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}` : `${-dueInDays} day${-dueInDays === 1 ? "" : "s"} overdue`}
              </span>
            )}
          </div>
          {currentBill ? (
            <>
              <p className="mt-2 text-3xl font-bold">{formatCurrency(currentBill.total, currentBill.currency)}</p>
              <p className="mt-1 text-xs text-white/80">
                For {formatPeriodMonth(currentBill.periodMonth)} · due {formatDate(currentBill.dueDate)}
              </p>
              <div className="mt-4">
                <Button
                  onClick={() => setPayOpen(true)}
                  className="bg-white text-accent-blue-strong hover:bg-white/90"
                >
                  Pay Now
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-white/90">You&apos;re all caught up — no outstanding bills.</p>
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
                    Home plan: {plan.sharedRatio ? <span className="text-accent-green">{plan.sharedRatio} shared</span> : plan.provider}
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
                    <span>{avgMbps.toFixed(0)} Mbps avg</span>
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
            <p className="text-sm text-text-muted">No active plan.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            {allOnline ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
                <span className="size-2.5 rounded-full bg-accent-green" />
              </span>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-red/15 text-red">
                <AlertTriangle className="size-4" />
              </span>
            )}
            <p className="text-lg font-semibold text-text-primary">
              {terminalSummary.totalCount === 0
                ? "No devices registered"
                : allOnline
                  ? "Connection is online"
                  : `${terminalSummary.totalCount - terminalSummary.activeCount} device${terminalSummary.totalCount - terminalSummary.activeCount === 1 ? "" : "s"} offline`}
            </p>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {terminalSummary.totalCount === 0
              ? "Contact support to activate a device on your account."
              : allOnline
                ? "No outages reported on your account over the last 30 days."
                : "We're monitoring the affected device(s). Contact support if this persists."}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-text-primary">This Month&apos;s Usage</p>
              <p className="text-xs text-text-muted">{periodRangeLabel(periodMonth)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Period:</span>
              <input
                type="month"
                value={periodInputValue}
                onChange={(e) => updatePeriod(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface-raised px-2.5 text-xs text-text-primary"
              />
            </div>
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex justify-center sm:justify-start">
              <UsageDonut usedGB={usage?.volumeDataGB ?? 0} allowanceGB={plan?.dataAllowanceGB ?? null} />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                  <Gauge className="size-4" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-text-primary">{(usage?.volumeDataGB ?? 0).toFixed(0)} GB</p>
                  <p className="text-xs text-text-muted">Data Used</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                  <Clock className="size-4" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-text-primary">{(usage?.dailyAverageGB ?? 0).toFixed(1)} GB</p>
                  <p className="text-xs text-text-muted">Daily average</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                  <Satellite className="size-4" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-text-primary">{String(terminalSummary.totalCount).padStart(2, "0")}</p>
                  <p className="text-xs text-text-muted">All Terminals</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-raised p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-green/15 text-accent-green">
                  <Radio className="size-4" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-text-primary">{String(terminalSummary.activeCount).padStart(2, "0")}</p>
                  <p className="text-xs text-text-muted">Active Terminals</p>
                </div>
              </div>
            </div>
          </div>
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
              <p className="text-base font-semibold text-text-primary">Latest Bill</p>
              <p className="text-xs text-text-muted">Your most recent invoices at a glance</p>
            </div>
          </div>
          <Link href="/portal/bills" className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline">
            View All <ArrowRight className="size-3" />
          </Link>
        </div>
        {latestBills.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-muted">No bills yet.</p>
        ) : (
          <div className="divide-y divide-line-soft">
            {latestBills.map((b) => (
              <Link
                key={b.id}
                href={`/portal/bills/${b.id}`}
                className="flex items-center justify-between py-3.5 hover:bg-surface-raised"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">{formatPeriodMonth(b.periodMonth)}</p>
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

      {payOpen && <PayNowModal onClose={() => setPayOpen(false)} />}
    </div>
  );
}
