"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { cancelInvoiceAction } from "@/lib/actions/invoices";

export function OutstandingBillRowActions({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel this invoice?")) return;
    setPending(true);
    const result = await cancelInvoiceAction(invoiceId);
    setPending(false);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Invoice cancelled.");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/admin/billing/${invoiceId}`}
        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue"
        aria-label="Edit invoice"
      >
        <Pencil className="size-4" />
      </Link>
      <button
        onClick={handleCancel}
        disabled={pending}
        className="rounded-lg p-1.5 text-text-muted hover:bg-red/10 hover:text-red disabled:opacity-50"
        aria-label="Cancel invoice"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
