import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, type InvoicePdfData } from "./InvoiceDocument";

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}

/**
 * Admin-facing reason a PDF failed to render. react-pdf lays out pages with
 * yoga-layout (WebAssembly); shared hosts that cap virtual memory (Hostinger /
 * CloudLinux) refuse the address space Node reserves for Wasm, which fails
 * every PDF there while it works everywhere else.
 */
export function describePdfError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/wasm|webassembly/i.test(message)) {
    return `The server's memory limit blocked the PDF engine (WebAssembly), so no PDF can be generated on this host. Details: ${message}`;
  }
  return `Couldn't generate the invoice PDF: ${message}`;
}
