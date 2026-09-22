"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { createPortalUserAction, updateAccountAccessAction } from "@/lib/actions/portalUsers";
import type { ActionState } from "@/lib/actions/customers";
import type { CustomerAccountRow, PortalUserRow } from "@/lib/types/admin";

// Create a portal login for a customer (mode "create"), or change which of
// the customer's accounts an existing login can see (mode "access").
export function PortalUserModal({
  profileId,
  accounts,
  user,
  onClose,
}: {
  profileId: string;
  accounts: CustomerAccountRow[];
  user: PortalUserRow | null;
  onClose: () => void;
}) {
  const mode = user ? "access" : "create";
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    mode === "create" ? createPortalUserAction : updateAccountAccessAction,
    undefined
  );
  const [allAccounts, setAllAccounts] = useState(user ? user.accountAccessAll : accounts.length <= 1);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={mode === "create" ? "Invite Portal User" : `Account access — ${user?.name}`}
      description={
        mode === "create"
          ? "Creates a customer portal login and emails an invitation with a temporary password. The user must set their own password at first sign-in."
          : "Choose which of this customer's accounts the user can see in the portal."
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="portal-user-form" loading={isPending}>
            {mode === "create" ? "Create & Send Invitation" : "Save Access"}
          </Button>
        </>
      }
    >
      <form id="portal-user-form" action={formAction} className="space-y-4">
        {mode === "create" ? (
          <>
            <input type="hidden" name="profileId" value={profileId} />
            <div>
              <Label required>Full Name</Label>
              <Input name="name" required minLength={2} />
            </div>
            <div>
              <Label required>Email (work or personal)</Label>
              <Input name="email" type="email" required />
            </div>
            <div>
              <Label>Phone</Label>
              <Input name="phone" />
            </div>
          </>
        ) : (
          <input type="hidden" name="userId" value={user?.id} />
        )}

        <div>
          <Label>Customer Account access</Label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface-raised px-3.5 py-3 text-sm text-text-primary">
            <Checkbox name="accountAccessAll" checked={allAccounts} onChange={(e) => setAllAccounts(e.target.checked)} />
            All accounts of this customer (including accounts added later)
          </label>
          {!allAccounts && (
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {accounts.length === 0 && <p className="p-2 text-xs text-text-muted">This customer has no accounts yet.</p>}
              {accounts.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-surface-raised">
                  <Checkbox name="accountIds" value={a.id} defaultChecked={user?.accountAccess.includes(a.id) ?? false} />
                  <span className="font-mono text-text-primary">{a.accountNumber}</span>
                  {a.name && <span className="text-xs text-text-muted">{a.name}</span>}
                  {a.status !== "ACTIVE" && <span className="text-xs text-amber">({a.status.toLowerCase()})</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">{state.error}</div>
        )}
      </form>
    </Modal>
  );
}
