"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wifi, Users, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlanFormModal } from "@/components/admin/PlanFormModal";
import { togglePlanActiveAction, deletePlanAction } from "@/lib/actions/plans";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { PlanFull } from "@/lib/types/plan";

export function PlansPageClient({ plans, canDelete }: { plans: PlanFull[]; canDelete: boolean }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanFull | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggle(plan: PlanFull) {
    setBusyId(plan.id);
    const result = await togglePlanActiveAction(plan.id, !plan.isActive);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Updated.");
      router.refresh();
    }
  }

  async function handleDelete(plan: PlanFull) {
    if (!confirm(`Delete "${plan.name}"? This cannot be undone.`)) return;
    setBusyId(plan.id);
    const result = await deletePlanAction(plan.id);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Deleted.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Service Plans</h1>
          <p className="text-sm text-text-muted">Manage pricing, allowances, and availability.</p>
        </div>
        <Button
          onClick={() => {
            setEditingPlan(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={Wifi}
          title="No service plans yet"
          description="Add your first plan to start assigning it to customers."
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Add Plan
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{plan.name}</p>
                    <Badge tone="blue" className="mt-1.5">
                      {plan.provider}
                    </Badge>
                  </div>
                  <Badge tone={plan.isActive ? "green" : "neutral"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <p className="mt-4 text-2xl font-bold text-text-primary">
                  {formatCurrency(plan.monthlyPrice, plan.currency)}
                  <span className="text-sm font-normal text-text-muted">/mo</span>
                </p>

                <div className="mt-4 flex-1 space-y-1.5 text-xs text-text-secondary">
                  <p>Data: {plan.dataAllowanceGB ? `${plan.dataAllowanceGB} GB` : "Unlimited"}</p>
                  {plan.voiceMinutes !== null && <p>Voice: {formatNumber(plan.voiceMinutes)} min</p>}
                  {plan.smsCount !== null && <p>SMS: {formatNumber(plan.smsCount)}</p>}
                  {plan.speedMbps && (
                    <p className="flex items-center gap-1">
                      <Gauge className="size-3" /> up to {plan.speedMbps} Mbps
                      {plan.sharedRatio ? ` · ${plan.sharedRatio} shared` : ""}
                    </p>
                  )}
                  <p className="flex items-center gap-1">
                    <Users className="size-3" /> {plan.subscriberCount} active subscriber
                    {plan.subscriberCount === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                  <Switch checked={plan.isActive} onChange={() => handleToggle(plan)} disabled={busyId === plan.id} />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingPlan(plan);
                        setModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue"
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(plan)}
                        disabled={busyId === plan.id}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-red/10 hover:text-red disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <PlanFormModal
          key={editingPlan?.id ?? "new"}
          plan={editingPlan}
          onClose={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
