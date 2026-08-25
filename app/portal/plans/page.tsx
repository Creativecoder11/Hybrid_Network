import type { Metadata } from "next";
import { Wifi, Gauge, Signal, MessageSquare } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getActivePlanInfo, getUsageForPeriod, currentPeriodMonth } from "@/lib/portal/data";
import { Card, CardContent } from "@/components/ui/Card";
import { LabeledProgress } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "My Plans | Hybrid Networks Portal",
};

export default async function PortalPlansPage() {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const [plan, usage] = await Promise.all([
    getActivePlanInfo(user.id),
    getUsageForPeriod(user.id, currentPeriodMonth()),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">My Plans</p>
        <p className="text-sm text-text-muted">Your active subscription and this period&apos;s usage.</p>
      </div>

      {!plan ? (
        <EmptyState icon={Wifi} title="No active plan" description="Contact support to get connected." />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-accent-green">{plan.provider}</p>
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
              {plan.sharedRatio && <span>{plan.sharedRatio} shared</span>}
              {plan.staticIp && <span className="font-mono">Static IP: {plan.staticIp}</span>}
            </div>

            <div className="mt-6 space-y-4">
              <LabeledProgress
                label="Data Allowance"
                value={usage?.volumeDataGB ?? 0}
                max={plan.dataAllowanceGB ?? Math.max(1, usage?.volumeDataGB ?? 1)}
                displayValue={
                  plan.dataAllowanceGB
                    ? `${(usage?.volumeDataGB ?? 0).toFixed(2)} / ${plan.dataAllowanceGB} GB`
                    : `${(usage?.volumeDataGB ?? 0).toFixed(2)} GB · Unlimited`
                }
                tone={
                  plan.dataAllowanceGB && (usage?.volumeDataGB ?? 0) > plan.dataAllowanceGB ? "red" : "green"
                }
              />
              {plan.voiceMinutes !== null && (
                <LabeledProgress
                  label="Voice Minutes"
                  value={usage?.volumeMin ?? 0}
                  max={plan.voiceMinutes}
                  displayValue={`${usage?.volumeMin ?? 0} / ${plan.voiceMinutes} min`}
                  tone="blue"
                />
              )}
              {plan.smsCount !== null && (
                <LabeledProgress
                  label="SMS"
                  value={usage?.volumeMsg ?? 0}
                  max={plan.smsCount}
                  displayValue={`${usage?.volumeMsg ?? 0} / ${plan.smsCount}`}
                  tone="amber"
                />
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Wifi className="size-3.5" /> {plan.terminalIds.length} terminals
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Signal className="size-3.5" /> {plan.subscriptionStatus}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <MessageSquare className="size-3.5" /> {usage?.volumeMsg ?? 0} SMS used
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
