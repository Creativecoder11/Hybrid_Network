"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { RetailPlanFormModal } from "@/components/admin/RetailPlanFormModal";
import { toggleRetailPlanActiveAction, deleteRetailPlanAction } from "@/lib/actions/retailPlans";
import { formatCurrency } from "@/lib/utils/format";
import type { RetailPlanRow } from "@/lib/types/retailBilling";

export function RetailPlansPageClient({ plans, canDelete }: { plans: RetailPlanRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RetailPlanRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RetailPlanRow | null>(null);

  async function handleToggle(plan: RetailPlanRow) {
    setBusyId(plan.id);
    const result = await toggleRetailPlanActiveAction(plan.id, !plan.isActive);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Updated.");
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const result = await deleteRetailPlanAction(deleteTarget.id);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Deleted.");
      setDeleteTarget(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">Retail Plans</p>
          <p className="text-sm">
            Wholesale-to-retail pricing rules applied to matched CDR identifiers.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPlan(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add Retail Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No Retail Plans yet"
          description="Create a Retail Plan to define how CDR wholesale charges are repriced for customers."
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Add Retail Plan
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex animated-border-card flex-col">
              <CardContent className="flex flex-1 flex-col pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{plan.name}</p>
                    <Badge tone="blue" className="mt-1.5">
                      {plan.pricingMethod === "PERCENTAGE_MARKUP" ? "Percentage Markup" : "Fixed Price"}
                    </Badge>
                  </div>
                  <Badge tone={plan.isActive ? "green" : "neutral"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
                </div>

                <p className="mt-4 text-2xl font-bold text-text-primary">
                  {plan.pricingMethod === "PERCENTAGE_MARKUP"
                    ? `${plan.markupPercent}%`
                    : formatCurrency(plan.fixedPrice, plan.currency)}
                  <span className="text-sm font-normal text-text-muted">
                    {plan.pricingMethod === "PERCENTAGE_MARKUP" ? " markup" : " fixed"}
                  </span>
                </p>

                {plan.description && (
                  <p className="mt-2 text-xs text-text-secondary">{plan.description}</p>
                )}

                <div className="mt-4 flex-1 space-y-1.5 text-xs text-text-secondary">
                  <p className="flex items-center gap-1">
                    <Link2 className="size-3" /> {plan.mappedIdentifierCount} mapped identifier
                    {plan.mappedIdentifierCount === 1 ? "" : "s"}
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
                        onClick={() => setDeleteTarget(plan)}
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
        <RetailPlanFormModal
          key={editingPlan?.id ?? "new"}
          plan={editingPlan}
          onClose={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name ?? "this plan"}"?`}
        description="This plan will be permanently deleted and cannot be recovered. Plans with active identifier mappings can't be deleted — deactivate it instead."
        loading={!!deleteTarget && busyId === deleteTarget.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
