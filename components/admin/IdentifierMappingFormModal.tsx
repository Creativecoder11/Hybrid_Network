"use client";

import { useActionState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { saveCdrMappingAction } from "@/lib/actions/cdrMappings";
import type { ActionState } from "@/lib/actions/customers";
import type { CdrIdentifierMappingRow } from "@/lib/types/retailBilling";

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
      title={mapping ? "Edit Identifier Mapping" : "Map CDR Identifier"}
      description="Link a CDR identifier to the Retail Plan used to price it."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="mapping-form" loading={isPending}>
            {mapping ? "Save Changes" : "Create Mapping"}
          </Button>
        </>
      }
    >
      <form id="mapping-form" action={formAction} className="space-y-4">
        {mapping && <input type="hidden" name="id" value={mapping.id} />}
        <input type="hidden" name="isActive" value="on" />

        <div>
          <Label required>CDR Identifier</Label>
          <Input
            name="identifier"
            defaultValue={mapping?.identifier ?? prefillIdentifier}
            placeholder="e.g. A123"
            required
          />
        </div>

        <div>
          <Label required>Retail Plan</Label>
          <Select name="retailPlanId" defaultValue={mapping?.retailPlanId ?? ""} required>
            <option value="" disabled>
              Choose a Retail Plan...
            </option>
            {retailPlans.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.isActive}>
                {p.name}
                {!p.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </Select>
        </div>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
            {state.error}
          </div>
        )}
      </form>
    </Modal>
  );
}
