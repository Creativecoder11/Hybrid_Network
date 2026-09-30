import type { Metadata } from "next";
import { Wifi, Gauge, Signal, Satellite, AlertTriangle } from "lucide-react";
import { getPortalContext } from "@/lib/accounts/access";
import { getActivePlanInfo, getServiceLinePlans } from "@/lib/portal/data";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LabeledProgress } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { NoAccountState } from "@/components/portal/NoAccountState";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import type { PortalServiceLinePlan } from "@/lib/types/portal";

export const metadata: Metadata = {
  title: "My Plans | Hybrid Networks Portal",
};

function gb(v: number | null): string {
  return v === null ? "Not available" : `${Math.round(v * 100) / 100} GB`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

function ServiceLineCard({ line }: { line: PortalServiceLinePlan }) {
  const allowance = line.allocatedDataGB ?? line.priorityDataGB;
  const used = line.usage?.priorityGB ?? null;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent-green">Starlink service line</p>
            <p className="mt-1 text-lg font-bold text-text-primary">{line.planName ?? "Plan not available"}</p>
            <p className="text-xs text-text-muted">
              {line.displayName}
              {line.serviceLineNumber ? ` · ${line.serviceLineNumber}` : ""}
            </p>
          </div>
          {line.serviceLineActive !== null && (
            <Badge tone={line.serviceLineActive ? "green" : "amber"}>{line.serviceLineActive ? "Active" : "Inactive"}</Badge>
          )}
        </div>

        {line.error && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
            <AlertTriangle className="size-3.5 shrink-0" />
            Some live details couldn&apos;t be loaded: {line.error}
          </p>
        )}

        {allowance !== null && used !== null && (
          <div className="mt-5">
            <LabeledProgress
              label="Priority data this cycle"
              value={used}
              max={Math.max(allowance, 0.01)}
              displayValue={`${used.toFixed(2)} / ${allowance.toFixed(2)} GB`}
              tone={used > allowance ? "red" : "green"}
            />
          </div>
        )}

        <div className="mt-4">
          <InfoRow
            label="Billing cycle"
            value={line.billingCycleStart && line.billingCycleEnd ? `${formatDate(line.billingCycleStart)} – ${formatDate(line.billingCycleEnd)}` : "Not available"}
          />
          <InfoRow label="Data allocated this cycle" value={gb(line.allocatedDataGB)} />
          <InfoRow label="Priority data allowance" value={gb(line.priorityDataGB)} />
          <InfoRow label="Standard data allowance" value={gb(line.standardDataGB)} />
          {line.blockDataGB !== null && <InfoRow label="Data blocks" value={gb(line.blockDataGB)} />}
          {line.topUpDataGB !== null && <InfoRow label="Top-up data" value={gb(line.topUpDataGB)} />}
          <InfoRow
            label="Overage"
            value={line.isOptedIntoOverage === null ? "Not available" : line.isOptedIntoOverage ? `Opted in${line.overageName ? ` (${line.overageName})` : ""}` : "Not opted in"}
          />
          <InfoRow label="Auto-renew" value={line.autoRenew === null ? "Not available" : line.autoRenew ? "Yes" : "No"} />
          {line.currentActivationDate && <InfoRow label="Plan active since" value={formatDate(line.currentActivationDate)} />}
          {line.subscriptionEndDate && <InfoRow label="Scheduled end" value={formatDate(line.subscriptionEndDate)} />}
          {line.usage?.lastUpdatedAt && <InfoRow label="Usage last updated" value={formatDateTime(line.usage.lastUpdatedAt)} />}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function PortalPlansPage() {
  const ctx = await getPortalContext();
  if (!ctx.account) return <NoAccountState title="My Plans" />;

  const [plan, serviceLines] = await Promise.all([getActivePlanInfo(ctx.account.id), getServiceLinePlans(ctx.account)]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">My Plans</p>
        <p className="text-sm text-text-muted">
          Service plans on account <span className="font-mono">{ctx.account.accountNumber}</span>.
        </p>
      </div>

      {!plan && serviceLines.length === 0 && (
        <EmptyState icon={Wifi} title="No plans on this account" description="Contact support to get connected." />
      )}

      {plan && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-accent-green">Hybrid Networks plan · {plan.provider}</p>
                <p className="mt-1 text-lg font-bold text-text-primary">{plan.planName}</p>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {formatCurrency(plan.monthlyPrice, plan.currency)}
                <span className="text-sm font-normal text-text-muted">/mo</span>
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
              {plan.speedMbps && (
                <span className="flex items-center gap-1.5">
                  <Gauge className="size-3.5 text-accent-green" /> up to {plan.speedMbps} Mbps
                </span>
              )}
              {plan.dataAllowanceGB !== null && <span>{plan.dataAllowanceGB} GB data included</span>}
              {plan.voiceMinutes !== null && <span>{plan.voiceMinutes} voice minutes</span>}
              {plan.smsCount !== null && <span>{plan.smsCount} SMS</span>}
              {plan.sharedRatio && <span>{plan.sharedRatio} shared</span>}
              {plan.staticIp && <span className="font-mono">Static IP: {plan.staticIp}</span>}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <Signal className="size-3.5" /> {plan.subscriptionStatus}
              </div>
              <div className="flex items-center gap-2">
                <Satellite className="size-3.5" /> Since {formatDate(plan.startDate)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {serviceLines.map((line) => (
        <ServiceLineCard key={line.vesselId} line={line} />
      ))}

      {serviceLines.length > 0 && (
        <p className="text-xs text-text-muted">
          Starlink service-line details are live from the SLASH API. Pricing for your plan is shown on your Hybrid
          Networks invoices.
        </p>
      )}
    </div>
  );
}
