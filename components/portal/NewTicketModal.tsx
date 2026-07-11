"use client";

import { useActionState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { createTicketAction } from "@/lib/actions/support";
import type { ActionState } from "@/lib/actions/customers";

export function NewTicketModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createTicketAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) onClose();
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
          <Button type="submit" form="ticket-form" loading={isPending}>
            Submit Ticket
          </Button>
        </>
      }
    >
      <form id="ticket-form" action={formAction} className="space-y-4">
        <div>
          <Label required>Subject</Label>
          <Input name="subject" required minLength={3} placeholder="Brief summary of your issue" />
        </div>
        <div>
          <Label required>Message</Label>
          <Textarea name="message" required rows={5} placeholder="Describe your issue in detail..." />
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
