"use client";

import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function DeleteConfirmModal({
  open,
  title = "Delete this item?",
  description = "This will be permanently deleted and cannot be recovered.",
  confirmLabel = "Delete",
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <div className="flex flex-col items-center px-2 py-2 text-center">
        <div className="relative mb-5 flex size-20 items-center justify-center rounded-2xl bg-red/10">
          <span className="absolute -top-1.5 left-3 text-sm font-bold leading-none text-red/50">+</span>
          <span className="absolute top-4 -right-2.5 text-xs font-bold leading-none text-red/40">+</span>
          <span className="absolute -bottom-2 left-1 text-xs font-bold leading-none text-red/40">+</span>
          <span className="absolute -right-1 bottom-3 size-1.5 rounded-full bg-red/40" />
          <span className="absolute -left-2 top-2 size-1 rounded-full bg-red/40" />
          <Trash2 className="size-8 text-red" strokeWidth={1.75} />
        </div>
        <p className="text-base font-semibold text-text-primary">{title}</p>
        <p className="mt-1.5 max-w-xs text-sm text-text-muted">{description}</p>
        <div className="mt-6 flex w-full gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1 border-transparent bg-red text-white hover:bg-red/90"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
