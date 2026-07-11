"use client";

import { useState } from "react";
import Link from "next/link";
import { Wifi, Signal, Gauge, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { UsageDonut } from "@/components/portal/UsageDonut";
import { PayNowModal } from "@/components/portal/PayNowModal";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils/format";
import type {
  PortalActivityRow,
  PortalInvoiceRow,
  PortalPlanInfo,
  PortalUsageInfo,
} from "@/lib/types/portal";

const STATUS_TONE: Record<PortalInvoiceRow["status"], "green" | "amber" | "red" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "amber",
  DUE: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELLED: "neutral",
};

export function OverviewClient({
  customerName,
  currentBill,
  plan,
  usage,
  latestBills,
  activity,
}: {
  customerName: string;
  currentBill: PortalInvoiceRow | null;
  plan: PortalPlanInfo | null;
  usage: PortalUsageInfo | null;
  latestBills: PortalInvoiceRow[];
  activity: PortalActivityRow[];
}) {
  const [payOpen, setPayOpen] = useState(false);
  const dueInDays = currentBill ? daysUntil(currentBill.dueDate) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Welcome back, {customerName.split(" ")[0]}</h1>
        <p className="text-sm text-text-muted">Here&apos;s what&apos;s happening with your account.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-accent-blue/90 to-accent-green/70 p-5 text-white lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">Current Bill</p>
          {currentBill ? (
            <>
              <p className="mt-2 text-3xl font-bold">{formatCurrency(currentBill.total, currentBill.currency)}</p>
              <p className="mt-1 text-xs text-white/80">Due {formatDate(currentBill.dueDate)}</p>
              {dueInDays !== null && (
                <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                  {dueInDays >= 0 ? `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}` : `${-dueInDays} day${-dueInDays === 1 ? "" : "s"} overdue`}
                </span>
              )}
              <div className="mt-4">
                <Button
                  onClick={() => setPayOpen(true)}
                  className="bg-white text-accent-blue-strong hover:bg-white/90"
                >
                  Pay Now
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-white/90">You&apos;re all caught up — no outstanding bills.</p>
          )}
        </div>

        <Card className="p-5">
          <p className="text-xs font-medium text-text-muted">Your Plan</p>
          {plan ? (
            <>
              <p className="mt-2 text-lg font-semibold text-text-primary">{plan.planName}</p>
              <p className="text-xs text-text-muted">
                {plan.provider} {plan.sharedRatio && `· ${plan.sharedRatio} shared`}
              </p>
              {plan.speedMbps && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
                  <Gauge className="size-3.5 text-accent-green" />
                  up to {plan.speedMbps} Mbps
                </div>
              )}
              {plan.staticIp && (
                <p className="mt-1 font-mono text-xs text-text-muted">Static IP: {plan.staticIp}</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-text-muted">No active plan.</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-text-muted">Connection Status</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${plan?.subscriptionStatus === "ACTIVE" ? "bg-accent-green" : "bg-red"}`}
            />
            <p className="text-lg font-semibold text-text-primary">
              {plan?.subscriptionStatus === "ACTIVE" ? "Connected" : "Not Connected"}
            </p>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {plan?.terminalIds.length ?? 0} terminal{(plan?.terminalIds.length ?? 0) === 1 ? "" : "s"} registered
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex justify-center sm:justify-start">
            <UsageDonut usedGB={usage?.volumeDataGB ?? 0} allowanceGB={plan?.dataAllowanceGB ?? null} />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-text-muted">Data Used</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {(usage?.volumeDataGB ?? 0).toFixed(2)} GB
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Daily Average</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {(usage?.dailyAverageGB ?? 0).toFixed(2)} GB
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-text-muted">
                <Wifi className="size-3" /> All Terminals
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{plan?.terminalIds.length ?? 0}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-text-muted">
                <Signal className="size-3" /> Voice Minutes
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{usage?.volumeMin ?? 0}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-text-muted">This Month&apos;s Usage</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Latest Bills</p>
            <Link href="/portal/bills" className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline">
              View All <ArrowRight className="size-3" />
            </Link>
          </div>
          {latestBills.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">No bills yet.</p>
          ) : (
            <div className="space-y-2">
              {latestBills.map((b) => (
                <Link
                  key={b.id}
                  href={`/portal/bills/${b.id}`}
                  className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 hover:bg-surface-raised"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{b.invoiceNumber}</p>
                    <p className="text-xs text-text-muted">{formatDate(b.issueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">{formatCurrency(b.total, b.currency)}</span>
                    <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-text-primary">Recent Activity</p>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-green" />
                  <div>
                    <p className="text-sm text-text-primary">{a.action.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="text-xs text-text-muted">{formatDate(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {payOpen && <PayNowModal onClose={() => setPayOpen(false)} />}
    </div>
  );
}
