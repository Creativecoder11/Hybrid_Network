"use client";

import { useActionState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { createTeamMemberAction } from "@/lib/actions/team";
import type { ActionState } from "@/lib/actions/customers";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

export function TeamFormModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createTeamMemberAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite Team Member"
      description="They'll receive an email to set their password and activate the account."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="team-form" loading={isPending}>
            Send Invite
          </Button>
        </>
      }
    >
      <form id="team-form" action={formAction} className="space-y-4">
        <Field label="Full Name" required>
          <Input name="name" required minLength={2} />
        </Field>
        <Field label="Email Address" required>
          <Input name="email" type="email" required />
        </Field>
        <Field label="Phone Number">
          <Input name="phone" />
        </Field>
        <Field label="Role" required>
          <Select name="role" defaultValue="SUB_ADMIN" required>
            <option value="SUB_ADMIN">Sub Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </Select>
        </Field>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
            {state.error}
          </div>
        )}
      </form>
    </Modal>
  );
}
