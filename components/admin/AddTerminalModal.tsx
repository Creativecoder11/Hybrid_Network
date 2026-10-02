"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { addTerminalAction } from "@/lib/actions/terminals";
import { formatDate } from "@/lib/utils/format";
import type { ActionState } from "@/lib/actions/customers";

export type AddTerminalOptions = {
  serviceLines: {
    serviceLineNumber: string;
    nickname: string;
    accountNumber: string;
    product: string;
    active: boolean;
    endDate: string | null;
  }[];
  /** Terminals on the Starlink account that are not attached to a service line. */
  unattachedTerminals: { userTerminalId: string; kitSerialNumber: string; dishSerialNumber: string }[];
  /** Set when the Starlink details could not be loaded. */
  error: string | null;
};

const OTHER = "__other__";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 text-right font-mono text-text-primary wrap-anywhere">{value || "Not available"}</span>
    </div>
  );
}

// Adds a user terminal to an existing Starlink service line. This is a real
// SLASH WRITE on the Starlink account, not a local record. Everything shown
// here is read live from the SLASH API; the server re-reads it on submit.
export function AddTerminalModal({ options, onClose }: { options: AddTerminalOptions; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(addTerminalAction, undefined);
  const { serviceLines, unattachedTerminals } = options;
  const [serviceLineNumber, setServiceLineNumber] = useState(
    (serviceLines.find((l) => l.active) ?? serviceLines[0])?.serviceLineNumber ?? ""
  );
  const [terminalChoice, setTerminalChoice] = useState(unattachedTerminals[0]?.userTerminalId ?? OTHER);

  const line = serviceLines.find((l) => l.serviceLineNumber === serviceLineNumber);
  const terminal = unattachedTerminals.find((t) => t.userTerminalId === terminalChoice);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
      onClose();
    }
  }, [state, onClose, router]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Terminal"
      description="Attach a Starlink user terminal to one of your service lines."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-terminal-form" loading={isPending} disabled={!line}>
            Add Terminal
          </Button>
        </>
      }
    >
      <form id="add-terminal-form" action={formAction} className="space-y-4">
        <p className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-xs text-amber">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          This changes your live Starlink account and may affect billing. Station Satcom is emailed about every change.
        </p>

        {options.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
            Starlink details couldn&apos;t be loaded: {options.error}
          </div>
        )}

        <div>
          <Label required>Service line</Label>
          <Select name="serviceLineNumber" value={serviceLineNumber} onChange={(e) => setServiceLineNumber(e.target.value)} required>
            {serviceLines.length === 0 && <option value="">No service lines found</option>}
            {serviceLines.map((l) => (
              <option key={l.serviceLineNumber} value={l.serviceLineNumber}>
                {l.nickname || "Starlink service line"} · {l.serviceLineNumber}
                {l.active ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </div>

        {line && (
          <div className="rounded-xl border border-line bg-surface-raised px-3.5 py-2 text-xs">
            <DetailRow label="Starlink account" value={line.accountNumber} />
            <DetailRow label="Product" value={line.product} />
            <DetailRow
              label="Status"
              value={line.active ? "Active" : `Inactive${line.endDate ? ` since ${formatDate(line.endDate)}` : ""}`}
            />
          </div>
        )}
        {line && !line.active && (
          <p className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-xs text-amber">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            This service line is inactive in Starlink, so Starlink will probably refuse to add a terminal to it.
          </p>
        )}

        <div>
          <Label required>Terminal</Label>
          <Select value={terminalChoice} onChange={(e) => setTerminalChoice(e.target.value)}>
            {unattachedTerminals.map((t) => (
              <option key={t.userTerminalId} value={t.userTerminalId}>
                {t.kitSerialNumber || t.userTerminalId} (not on a service line)
              </option>
            ))}
            <option value={OTHER}>A new terminal — enter its device ID</option>
          </Select>
        </div>

        {terminal ? (
          <div className="rounded-xl border border-line bg-surface-raised px-3.5 py-2 text-xs">
            <input type="hidden" name="deviceId" value={terminal.userTerminalId} />
            <DetailRow label="Terminal ID" value={terminal.userTerminalId} />
            <DetailRow label="Kit serial" value={terminal.kitSerialNumber} />
            <DetailRow label="Dish serial" value={terminal.dishSerialNumber} />
          </div>
        ) : (
          <div>
            <Label required>Device ID</Label>
            <Input name="deviceId" required minLength={6} maxLength={64} className="font-mono" placeholder="e.g. KIT4M01412175C9V" />
            <p className="mt-1 text-[11px] text-text-muted">
              The kit serial number or user terminal ID printed on the Starlink kit. It is registered on the Starlink
              account first, then added to the service line.
            </p>
          </div>
        )}

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">{state.error}</div>
        )}
      </form>
    </Modal>
  );
}
