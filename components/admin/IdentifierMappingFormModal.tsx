"use client";

import { useActionState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { saveCdrMappingAction } from "@/lib/actions/cdrMappings";
import type { ActionState } from "@/lib/actions/customers";
import type { CdrIdentifierMappingRow } from "@/lib/types/retailBilling";

const TYPES: { value: CdrIdentifierMappingRow["productType"]; label: string }[] = [
  { value: "CALL", label: "Call / Voice" },
  { value: "SMS", label: "SMS" },
  { value: "DATA", label: "Data" },
  { value: "SERVICE", label: "Service / subscription" },
  { value: "OTHER", label: "Other" },
];

export function IdentifierMappingFormModal({
  mapping,
  prefillIdentifier,
  retailPlans,
  onClose,
}: {
  mapping: CdrIdentifierMappingRow | null;
  prefillIdentifier?: string;
  retailPlans: { id: string; name: string; isActive: boolean }[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(saveCdrMappingAction, undefined);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={mapping ? `Edit Product Code ${mapping.identifier}` : "Add Product Code"}
      description="CDR records are only allocated when their Product Code matches an active code here (case-insensitive)."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="mapping-form" loading={isPending}>
            {mapping ? "Save Changes" : "Add Product Code"}
          </Button>
        </>
      }
    >
      <form id="mapping-form" action={formAction} className="space-y-4">
        {mapping && <input type="hidden" name="id" value={mapping.id} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label required>Product Code</Label>
            <Input
              name="identifier"
              defaultValue={mapping?.identifier ?? prefillIdentifier}
              placeholder="e.g. 123"
              className="font-mono"
              required
            />
          </div>
          <div>
            <Label required>Product Name</Label>
            <Input name="name" defaultValue={mapping?.name} placeholder="e.g. Voice call" required />
          </div>
          <div>
            <Label required>Product Type</Label>
            <Select name="productType" defaultValue={mapping?.productType ?? "OTHER"} required>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-text-muted">
              Call / SMS / Data are checked against the CDR row&apos;s record type when the file has one.
            </p>
          </div>
          <div>
            <Label>Service / Category</Label>
            <Input name="category" defaultValue={mapping?.category} placeholder="e.g. Voice, Starlink Data" />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea name="description" rows={2} defaultValue={mapping?.description} />
        </div>

        <div>
          <Label>Pricing rule (Retail Plan)</Label>
          <Select name="retailPlanId" defaultValue={mapping?.retailPlanId ?? ""}>
            <option value="">No pricing — allocation only</option>
            {retailPlans.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.isActive}>
                {p.name}
                {!p.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-[11px] text-text-muted">
            Required for the retail CDR import to price this product. Usage CDR uploads only need the code to exist.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text-primary">
          <Checkbox name="isActive" defaultChecked={mapping ? mapping.isActive : true} />
          Active
        </label>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">{state.error}</div>
        )}
      </form>
    </Modal>
  );
}
