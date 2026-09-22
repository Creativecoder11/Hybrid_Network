import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, type InvoicePdfData } from "@/lib/pdf/InvoiceDocument";

// Renders the tax invoice to a real PDF with the Hybrid Networks logo and
// checks the output is a valid PDF. (Run without the react-server condition:
// @react-pdf needs the full React build.)

function sample(overrides: Partial<InvoicePdfData> = {}): InvoicePdfData {
  return {
    invoiceNumber: "HINV-1042",
    issueDate: "01 Sep 2026",
    dueDate: "15 Sep 2026",
    billingPeriod: "1 Aug 2026 – 31 Aug 2026",
    status: "DUE",
    customer: {
      name: "Jane Doe",
      company: "ABC Marine Pty Ltd",
      customerId: "HN-CUST-00011",
      accountNumber: "10001",
      accountName: "MV Pacific Star",
      email: "accounts@abcmarine.example",
      phone: "",
      address: "1 Harbour St, Sydney NSW 2000",
    },
    company: {
      name: "Hybrid Networks",
      legalName: "Hybrid Networks Pty Ltd",
      abn: "",
      address: "",
      email: "",
      phone: "",
      website: "",
      paymentInstructions: "",
    },
    logo: readFileSync(path.join(process.cwd(), "public", "assets", "hybrid-logo-invoice.png")),
    lineItems: [
      { description: "Starlink Maritime 50GB — Monthly Subscription", quantity: 1, unit: "month", unitPrice: 250, amount: 250 },
      { description: "Voice call — CDR 123", quantity: 1, unit: "", unitPrice: 1.5, amount: 1.5 },
    ],
    subtotal: 251.5,
    taxLabel: "GST",
    taxRate: 10,
    taxAmount: 25.15,
    total: 276.65,
    amountPaid: 0,
    balanceDue: 276.65,
    currency: "AUD",
    usageSummary: { dataGB: 42.5, voiceMin: 12, sms: 3 },
    paidDate: null,
    lastInvoices: [{ periodMonth: "202607", total: 250 }],
    ...overrides,
  };
}

test("tax invoice renders to a PDF with logo", async () => {
  const buf = await renderToBuffer(<InvoiceDocument data={sample()} />);
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buf.length > 5000, `PDF unexpectedly small (${buf.length} bytes)`);
});

test("paid invoice with full company details and no logo still renders", async () => {
  const buf = await renderToBuffer(
    <InvoiceDocument
      data={sample({
        status: "PAID",
        amountPaid: 276.65,
        balanceDue: 0,
        paidDate: "10 Sep 2026",
        paymentMethod: "Bank Transfer",
        logo: null,
        company: {
          name: "Hybrid Networks",
          legalName: "Hybrid Networks Pty Ltd",
          abn: "51824753556",
          address: "Level 1, Example St, Sydney NSW 2000",
          email: "billing@example.com",
          phone: "+61 2 0000 0000",
          website: "www.example.com",
          paymentInstructions: "BSB 000-000 Account 00000000",
        },
      })}
    />
  );
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
});
