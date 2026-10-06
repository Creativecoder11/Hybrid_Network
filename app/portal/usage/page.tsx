import type { Metadata } from "next";
import { BarChart3, AlertTriangle } from "lucide-react";
import { getPortalContext } from "@/lib/accounts/access";
import { getDailyUsage, getServiceLinePlans } from "@/lib/portal/data";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DailyUsageChart } from "@/components/portal/DailyUsageChart";
import { NoAccountState } from "@/components/portal/NoAccountState";
import { UsagePeriodFilter } from "@/components/portal/UsagePeriodFilter";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Usage | Hybrid Networks Portal",
};

const DAY_MS = 24 * 60 * 60 * 1000;
// How many years back the month/year filter offers.
const YEARS_BACK = 2;

/** ?month=MM&year=YYYY → that calendar month (UTC); otherwise the last 30 days. */
function resolvePeriod(sp: Record<string, string | string[] | undefined>) {
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const month = Number(sp.month);
  const year = Number(sp.year);
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  const validYear = Number.isInteger(year) && year >= thisYear - YEARS_BACK && year <= thisYear;
  if (validMonth && validYear && Date.UTC(year, month - 1, 1) <= now.getTime()) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Math.min(Date.UTC(year, month, 1) - 1, now.getTime()));
    const label = start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    return { month, year, start, end, label };
  }
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { month: null, year: thisYear, start: new Date(todayStart - 29 * DAY_MS), end: now, label: "Last 30 days" };
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function PortalUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getPortalContext();
  if (!ctx.account) return <NoAccountState title="Usage" />;
  const account = ctx.account;

  const period = resolvePeriod(await searchParams);
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => thisYear - i);

  const [daily, serviceLines] = await Promise.all([
    getDailyUsage(account, { start: period.start, end: period.end }),
    getServiceLinePlans(account),
  ]);
  const hasStarlink = account.starlinkVesselIds.length > 0;

  const totals = daily.rows.reduce(
    (acc, r) => ({
      priorityGB: acc.priorityGB + r.priorityGB,
      standardGB: acc.standardGB + r.standardGB,
      nonBillableGB: acc.nonBillableGB + r.nonBillableGB,
      totalGB: acc.totalGB + r.totalGB,
    }),
    { priorityGB: 0, standardGB: 0, nonBillableGB: 0, totalGB: 0 }
  );
  const activeDays = daily.rows.filter((r) => r.totalGB > 0).length;
  const peak = daily.rows.reduce<(typeof daily.rows)[number] | null>(
    (best, r) => (r.totalGB > (best?.totalGB ?? 0) ? r : best),
    null
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">Usage</p>
        <p className="text-sm text-text-muted">
          Data usage for account <span className="font-mono">{account.accountNumber}</span>.
        </p>
      </div>

      {hasStarlink && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {serviceLines.map((line) => (
              <Card key={line.vesselId} className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-accent-green">Current billing cycle</p>
                <p className="mt-1 truncate text-sm font-semibold text-text-primary">{line.displayName}</p>
                {line.usage ? (
                  <>
                    <p className="mt-2 text-2xl font-bold text-text-primary">{line.usage.totalGB.toFixed(2)} GB</p>
                    <p className="text-xs text-text-muted">
                      {formatDate(line.usage.billingCycleStart)} – {formatDate(line.usage.billingCycleEnd)}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-text-muted">Priority</p>
                        <p className="font-medium text-text-primary">{line.usage.priorityGB.toFixed(2)} GB</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Standard</p>
                        <p className="font-medium text-text-primary">{line.usage.standardGB.toFixed(2)} GB</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Non-billable</p>
                        <p className="font-medium text-text-primary">{line.usage.nonBillableGB.toFixed(2)} GB</p>
                      </div>
                    </div>
                    {line.usage.lastUpdatedAt && (
                      <p className="mt-2 text-[11px] text-text-muted">Updated {formatDateTime(line.usage.lastUpdatedAt)}</p>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-xs text-text-muted">{line.error ?? "No usage data available for this cycle."}</p>
                )}
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-text-primary">Daily usage — {period.label}</p>
                <p className="text-xs text-text-muted">
                  Live from Starlink, all service lines on this account combined. Days are in UTC.
                </p>
              </div>
              <UsagePeriodFilter month={period.month} year={period.year} years={years} />
            </div>
            {daily.error && (
              <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
                <AlertTriangle className="size-3.5 shrink-0" />
                {daily.rows.length > 0 ? `Some service lines couldn't be loaded: ${daily.error}` : daily.error}
              </p>
            )}
            {daily.rows.length > 0 && totals.totalGB > 0 ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-line bg-surface-raised p-3">
                    <p className="text-xs text-text-muted">Total</p>
                    <p className="text-lg font-semibold text-text-primary">{totals.totalGB.toFixed(2)} GB</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-raised p-3">
                    <p className="text-xs text-text-muted">Daily average</p>
                    <p className="text-lg font-semibold text-text-primary">
                      {(totals.totalGB / daily.rows.length).toFixed(2)} GB
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-raised p-3">
                    <p className="text-xs text-text-muted">Peak day</p>
                    <p className="text-lg font-semibold text-text-primary">{peak ? `${peak.totalGB.toFixed(2)} GB` : "--"}</p>
                    {peak && <p className="text-[11px] text-text-muted">{formatDay(peak.date)}</p>}
                  </div>
                  <div className="rounded-xl border border-line bg-surface-raised p-3">
                    <p className="text-xs text-text-muted">Days with usage</p>
                    <p className="text-lg font-semibold text-text-primary">
                      {activeDays} / {daily.rows.length}
                    </p>
                  </div>
                </div>
                <DailyUsageChart data={daily.rows} />
              </>
            ) : (
              !daily.error && (
                <p className="py-8 text-center text-sm text-text-muted">No usage recorded for {period.label.toLowerCase()}.</p>
              )
            )}
          </Card>

        </>
      )}

      {!hasStarlink && (
        <EmptyState
          icon={BarChart3}
          title="No usage data available"
          description="Daily usage appears here once a Starlink service line is linked to this account."
        />
      )}
    </div>
  );
}
