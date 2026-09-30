"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Downloads /api/invoices/[id]/pdf as a file. Fetched (not a plain link) so a
// failed generation shows an error instead of a JSON page or a broken file.
async function downloadInvoicePdf(invoiceId: string, invoiceNumber: string) {
  const res = await fetch(`/api/invoices/${invoiceId}/pdf?download=1`, { cache: "no-store" });
  if (!res.ok || !res.headers.get("content-type")?.includes("application/pdf")) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `The invoice PDF could not be downloaded (${res.status}).`);
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("The invoice PDF was empty.");

  const disposition = res.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `invoice-${invoiceNumber}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function InvoicePdfButton({
  invoiceId,
  invoiceNumber,
  variant = "button",
}: {
  invoiceId: string;
  invoiceNumber: string;
  variant?: "button" | "icon";
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await downloadInvoicePdf(invoiceId, invoiceNumber);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The invoice PDF could not be downloaded.");
    } finally {
      setPending(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue disabled:opacity-50"
        aria-label="Download PDF"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      </button>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} loading={pending}>
      {!pending && <Download className="size-4" />}
      Download PDF
    </Button>
  );
}
