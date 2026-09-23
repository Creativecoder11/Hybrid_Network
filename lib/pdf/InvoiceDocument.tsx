import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

export type InvoicePdfData = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  billingPeriod: string;
  status: string;
  customer: {
    name: string;
    company: string;
    customerId: string;
    accountNumber: string;
    accountName: string;
    email: string;
    phone: string;
    address: string;
  };
  company: {
    name: string;
    legalName: string;
    abn: string;
    address: string;
    email: string;
    phone: string;
    website: string;
    paymentInstructions: string;
  };
  /** PNG logo (white wordmark, drawn on the navy header band). */
  logo: Buffer | null;
  lineItems: { description: string; quantity: number; unit: string; unitPrice: number; amount: number }[];
  subtotal: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  usageSummary: { dataGB: number; voiceMin: number; sms: number } | null;
  paymentMethod?: string;
  paidDate?: string | null;
  lastInvoices?: { periodMonth: string; total: number }[];
};

const NAVY = "#0B1B33";
const BLUE = "#0f6fd6";
const BLUE_DARK = "#0b3f7a";
const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

const styles = StyleSheet.create({
  page: { paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica", color: INK },
  band: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 150, height: 44, objectFit: "contain" },
  brandText: { fontSize: 18, fontWeight: 700, color: "#ffffff" },
  bandRight: { alignItems: "flex-end" },
  invoiceTitle: { fontSize: 16, fontWeight: 700, color: "#ffffff", letterSpacing: 1 },
  invoiceTitleSub: { fontSize: 9, color: "#93C5FD", marginTop: 2 },
  statusPill: {
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 7.5,
    fontWeight: 700,
    color: "#ffffff",
  },

  body: { paddingHorizontal: 36, paddingTop: 20 },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  colBlock: { width: "48%" },
  label: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  strong: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  value: { fontSize: 9, marginBottom: 1.5, color: "#374151" },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: LINE, borderRadius: 4, marginBottom: 18 },
  metaCell: { width: "33.33%", paddingVertical: 7, paddingHorizontal: 10, borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  metaLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  metaValue: { fontSize: 9, fontWeight: 700, color: INK, marginTop: 2 },

  table: { borderWidth: 1, borderColor: "#DBEAFE", borderRadius: 4 },
  thead: { flexDirection: "row", backgroundColor: BLUE, paddingVertical: 7, paddingHorizontal: 10 },
  th: { fontSize: 8, fontWeight: 700, color: "#ffffff" },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: "#EFF6FF" },
  td: { fontSize: 8.5 },
  cDesc: { width: "52%" },
  cQty: { width: "14%", textAlign: "right" },
  cUnit: { width: "16%", textAlign: "right" },
  cAmt: { width: "18%", textAlign: "right" },

  totals: { alignSelf: "flex-end", width: "46%", marginTop: 10 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 8.5, color: "#4B5563" },
  totalsValue: { fontSize: 8.5 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: "#EFF6FF",
  },
  grandLabel: { fontSize: 10.5, fontWeight: 700, color: BLUE_DARK },
  grandValue: { fontSize: 12, fontWeight: 700, color: BLUE_DARK },

  panelRow: { flexDirection: "row", gap: 14, marginTop: 18 },
  panel: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 10 },
  panelTitle: { fontSize: 8.5, fontWeight: 700, color: INK, marginBottom: 4 },
  panelText: { fontSize: 8, color: "#4B5563", lineHeight: 1.5 },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 6.5,
    color: "#9CA3AF",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
  },
});

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6B7280",
  SENT: "#F59E0B",
  DUE: "#F59E0B",
  OVERDUE: "#DC2626",
  PAID: "#059669",
  CANCELLED: "#6B7280",
};

function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
  const value = amount ?? 0;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value).toFixed(2);
  const c = (currency || "").trim().toUpperCase();
  if (c === "AUD" || c === "USD" || c === "CAD" || c === "NZD" || c === "$" || c === "A$" || !c) {
    return `${sign}$${abs}`;
  }
  return `${currency} ${abs}`;
}

function formatPeriodLabel(periodMonth: string) {
  if (!periodMonth || periodMonth.length !== 6) return periodMonth;
  const year = periodMonth.slice(0, 4);
  const month = Number(periodMonth.slice(4, 6));
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[month - 1] ?? ""} ${year}`;
}

function formatAbn(abn: string) {
  const d = abn.replace(/\s+/g, "");
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : abn;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || "--"}</Text>
    </View>
  );
}

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const lastInvoices = data.lastInvoices ?? [];
  const c = data.company;
  const taxInclusiveLabel = `Total (incl. ${data.taxLabel})`;

  return (
    <Document title={`Tax Invoice ${data.invoiceNumber}`} author={c.legalName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          {data.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image style={styles.logo} src={data.logo} />
          ) : (
            <Text style={styles.brandText}>{c.name}</Text>
          )}
          <View style={styles.bandRight}>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceTitleSub}>{data.invoiceNumber}</Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[data.status] ?? "#6B7280" }]}>
              <Text>{data.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.twoCol}>
            <View style={styles.colBlock}>
              <Text style={styles.label}>From</Text>
              <Text style={styles.strong}>{c.legalName}</Text>
              {c.abn ? <Text style={styles.value}>ABN {formatAbn(c.abn)}</Text> : null}
              {c.address ? <Text style={styles.value}>{c.address}</Text> : null}
              {c.email ? <Text style={styles.value}>{c.email}</Text> : null}
              {c.phone ? <Text style={styles.value}>{c.phone}</Text> : null}
              {c.website ? <Text style={styles.value}>{c.website}</Text> : null}
            </View>
            <View style={styles.colBlock}>
              <Text style={styles.label}>Bill To</Text>
              <Text style={styles.strong}>{data.customer.company || data.customer.name}</Text>
              {data.customer.company ? <Text style={styles.value}>Attn: {data.customer.name}</Text> : null}
              {data.customer.address ? <Text style={styles.value}>{data.customer.address}</Text> : null}
              <Text style={styles.value}>{data.customer.email}</Text>
              {data.customer.phone ? <Text style={styles.value}>{data.customer.phone}</Text> : null}
            </View>
          </View>

          <View style={styles.metaGrid}>
            <Meta label="Invoice Number" value={data.invoiceNumber} />
            <Meta label="Invoice Date" value={data.issueDate} />
            <Meta label="Due Date" value={data.dueDate} />
            <Meta label="Customer Account No." value={data.customer.accountNumber} />
            <Meta label="Customer ID" value={data.customer.customerId} />
            <Meta label="Billing Period" value={data.billingPeriod} />
          </View>

          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th, styles.cDesc]}>Description</Text>
              <Text style={[styles.th, styles.cQty]}>Qty</Text>
              <Text style={[styles.th, styles.cUnit]}>Unit Price</Text>
              <Text style={[styles.th, styles.cAmt]}>Amount</Text>
            </View>
            {data.lineItems.map((item, i) => (
              <View style={styles.tr} key={i} wrap={false}>
                <Text style={[styles.td, styles.cDesc]}>{item.description}</Text>
                <Text style={[styles.td, styles.cQty]}>
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                </Text>
                <Text style={[styles.td, styles.cUnit]}>{money(item.unitPrice, data.currency)}</Text>
                <Text style={[styles.td, styles.cAmt]}>{money(item.amount, data.currency)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal (excl. {data.taxLabel})</Text>
              <Text style={styles.totalsValue}>{money(data.subtotal, data.currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {data.taxLabel} @ {data.taxRate.toFixed(2)}%
              </Text>
              <Text style={styles.totalsValue}>{money(data.taxAmount, data.currency)}</Text>
            </View>
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>{taxInclusiveLabel}</Text>
              <Text style={styles.grandValue}>{money(data.total, data.currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Amount paid{data.paidDate ? ` (${data.paidDate})` : ""}</Text>
              <Text style={styles.totalsValue}>{money(data.amountPaid, data.currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { fontWeight: 700, color: INK }]}>Balance due</Text>
              <Text style={[styles.totalsValue, { fontWeight: 700 }]}>{money(data.balanceDue, data.currency)}</Text>
            </View>
          </View>

          <View style={styles.panelRow} wrap={false}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>How to pay</Text>
              {data.status === "PAID" ? (
                <Text style={styles.panelText}>
                  Paid{data.paymentMethod ? ` via ${data.paymentMethod}` : ""}{data.paidDate ? ` on ${data.paidDate}` : ""}. Thank you.
                </Text>
              ) : c.paymentInstructions ? (
                <Text style={styles.panelText}>{c.paymentInstructions}</Text>
              ) : (
                <Text style={styles.panelText}>
                  Please contact {c.email || c.legalName} for payment details.
                </Text>
              )}
              {data.status !== "PAID" ? (
                <Text style={[styles.panelText, { marginTop: 4 }]}>
                  Payment reference: {data.invoiceNumber}
                  {data.customer.accountNumber ? ` / ${data.customer.accountNumber}` : ""}
                </Text>
              ) : null}
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Questions about this invoice?</Text>
              <Text style={styles.panelText}>
                {[c.email, c.phone].filter(Boolean).join(" · ") || c.legalName}
              </Text>
              {data.usageSummary ? (
                <Text style={[styles.panelText, { marginTop: 4 }]}>
                  Usage this period: {data.usageSummary.dataGB.toFixed(2)} GB data · {data.usageSummary.voiceMin} voice
                  min · {data.usageSummary.sms} SMS
                </Text>
              ) : null}
              {lastInvoices.length > 0 ? (
                <Text style={[styles.panelText, { marginTop: 4 }]}>
                  Previous invoices:{" "}
                  {lastInvoices.map((inv) => `${formatPeriodLabel(inv.periodMonth)} ${money(inv.total, data.currency)}`).join(" · ")}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {[c.legalName, c.abn ? `ABN ${formatAbn(c.abn)}` : "", c.address].filter(Boolean).join(" · ")}
        </Text>
      </Page>
    </Document>
  );
}

// Keep words whole (no hyphenation) in the built-in Helvetica font.
Font.registerHyphenationCallback((word) => [word]);
