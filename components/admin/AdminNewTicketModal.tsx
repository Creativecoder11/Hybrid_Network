"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { adminCreateTicketAction } from "@/lib/actions/support";
import type { ActionState } from "@/lib/actions/customers";
import type { TicketCustomerOption } from "@/lib/types/support";

/**
 * Opens a ticket on a Customer Profile's behalf. Pass `customer` to lock it to
 * one profile (customer detail page), or `customers` to let the admin pick.
 */
export function AdminNewTicketModal({
  customer,
  customers = [],
  onClose,
}: {
  customer?: TicketCustomerOption;
  customers?: TicketCustomerOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    adminCreateTicketAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title="New Support Ticket"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="admin-ticket-form" loading={isPending}>
            Create Ticket
          </Button>
        </>
      }
    >
      <form id="admin-ticket-form" action={formAction} className="space-y-4">
        <div>
          <Label required>Customer</Label>
          {customer ? (
            <>
              <input type="hidden" name="customerId" value={customer.id} />
              <Input value={customer.code ? `${customer.name} (${customer.code})` : customer.name} disabled readOnly />
            </>
          ) : (
            <Select name="customerId" required defaultValue="">
              <option value="" disabled>
                Select a customer
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.name} (${c.code})` : c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label required>Subject</Label>
          <Input name="subject" required minLength={3} placeholder="Brief summary of the issue" />
        </div>
        <div>
          <Label required>Category</Label>
          <Select name="category" defaultValue="GENERAL">
            <option value="GENERAL">General</option>
            <option value="BILLING">Billing</option>
            <option value="TECHNICAL">Technical</option>
            <option value="SERVICE">Service</option>
          </Select>
        </div>
        <div>
          <Label required>Message</Label>
          <Textarea name="message" required rows={5} placeholder="Describe the issue for the customer..." />
        </div>
        <p className="text-xs text-text-muted">
          The customer sees this ticket in their portal, gets an email about it, and can reply.
        </p>
        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
            {state.error}
          </div>
        )}
      </form>
    </Modal>
  );
}
