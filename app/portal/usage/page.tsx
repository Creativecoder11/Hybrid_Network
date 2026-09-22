import type { Metadata } from "next";
import { BarChart3, AlertTriangle } from "lucide-react";
import { getPortalContext } from "@/lib/accounts/access";
import { getDailyUsage, getServiceLinePlans, getUsageHistory } from "@/lib/portal/data";
import { Card } from "@/components/ui/Card";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsageChart } from "@/components/portal/UsageChart";
import { DailyUsageChart } from "@/components/portal/DailyUsageChart";
import { NoAccountState } from "@/components/portal/NoAccountState";
import { formatDate, formatDateTime, formatPeriodMonth } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Usage | Hybrid Networks Portal",
};

export default async function PortalUsagePage() {
  const ctx = await getPortalContext();
  if (!ctx.account) return <NoAccountState title="Usage" />;
  const account = ctx.account;

  const [daily, serviceLines, history] = await Promise.all([
    getDailyUsage(account, 30),
    getServiceLinePlans(account),
    getUsageHistory(account.id),
  ]);
  const hasStarlink = account.starlinkVesselIds.length > 0;

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
            <p className="text-base font-semibold text-text-primary">Daily usage — last 30 days</p>
            <p className="mb-4 text-xs text-text-muted">Live from Starlink, all service lines on this account combined.</p>
            {daily.error && (
              <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
                <AlertTriangle className="size-3.5 shrink-0" />
                {daily.rows.length > 0 ? `Some service lines couldn't be loaded: ${daily.error}` : daily.error}
              </p>
            )}
            {daily.rows.length > 0 ? (
              <DailyUsageChart data={daily.rows} />
            ) : (
              !daily.error && <p className="py-8 text-center text-sm text-text-muted">No usage data available for the last 30 days.</p>
            )}
          </Card>
        </>
      )}

      <div>
        <p className="text-base font-semibold text-text-primary">Monthly usage history</p>
        <p className="text-xs text-text-muted">From rated CDR records processed by Hybrid Networks (last 12 months).</p>
      </div>
      {history.length === 0 ? (
        <EmptyState icon={BarChart3} title="No usage data available" description="Monthly usage appears here once rated CDR records are processed for this account." />
      ) : (
        <>
          <Card className="p-5">
            <UsageChart data={history} />
          </Card>

          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH>Data Used</TH>
                  <TH>Voice Minutes</TH>
                </TR>
              </THead>
              <TBody>
                {[...history].reverse().map((r) => (
                  <TR key={r.periodMonth}>
                    <TD className="font-medium text-text-primary">{formatPeriodMonth(r.periodMonth)}</TD>
                    <TD>{r.volumeDataGB.toFixed(2)} GB</TD>
                    <TD>{r.volumeMin}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </>
      )}
    </div>
  );
}
