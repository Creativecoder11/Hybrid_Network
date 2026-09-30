"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, User as UserIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { adminCreateTicketAction } from "@/lib/actions/support";
import type { ActionState } from "@/lib/actions/customers";
import type { TicketCustomerOption } from "@/lib/types/support";

function customerLabel(c: TicketCustomerOption): string {
  return c.company && c.company !== c.name ? `${c.name} — ${c.company}` : c.name;
}

export function AdminNewTicketModal({
  customers,
  onClose,
}: {
  customers: TicketCustomerOption[];
  onClose: () => void;
}) {
  // On success the action redirects to the new ticket, so only errors come back.
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(adminCreateTicketAction, undefined);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TicketCustomerOption | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers.slice(0, 8);
    return customers
      .filter((c) =>
        [c.name, c.company, c.customerId, c.email, ...c.accountNumbers].some((v) => v.toLowerCase().includes(needle))
      )
      .slice(0, 8);
  }, [search, customers]);

  function pick(c: TicketCustomerOption) {
    setSelected(c);
    setSearch(customerLabel(c));
    setOpen(false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create Support Ticket"
      description="Open a ticket on a customer's behalf. It appears in their customer portal."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="admin-ticket-form" loading={isPending} disabled={!selected}>
            Create Ticket
          </Button>
        </>
      }
    >
      <form id="admin-ticket-form" action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={selected?.id ?? ""} />

        <div>
          <Label required>Customer</Label>
          <div className="relative">
            <Input
              icon={<UserIcon className="size-4" />}
              placeholder="Search by name, company, customer ID, email or account number..."
              value={search}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
                setOpen(true);
              }}
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            {open && !selected && (
              <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface-raised shadow-xl">
                {filtered.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-sm text-text-muted">No customers match &ldquo;{search}&rdquo;.</p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-text-primary hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{customerLabel(c)}</span>
                        <span className="block truncate text-xs text-text-muted">{c.email}</span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-xs text-accent-green">
                        {c.customerId}
                        {c.accountNumbers.length > 0 && (
                          <span className="block text-text-muted">{c.accountNumbers.slice(0, 2).join(", ")}</span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <Label required>Subject</Label>
          <Input name="subject" required minLength={3} placeholder="Brief summary of the issue" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select name="category" defaultValue="GENERAL">
              <option value="GENERAL">General</option>
              <option value="BILLING">Billing</option>
              <option value="TECHNICAL">Technical</option>
              <option value="SERVICE">Service</option>
            </Select>
          </div>
          <div>
            <Label>Initial Status</Label>
            <Select name="status" defaultValue="OPEN">
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
            </Select>
          </div>
        </div>

        <div>
          <Label required>Description</Label>
          <Textarea name="message" required minLength={5} rows={5} placeholder="Describe the issue in detail..." />
        </div>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">{state.error}</div>
        )}
      </form>
    </Modal>
  );
}
