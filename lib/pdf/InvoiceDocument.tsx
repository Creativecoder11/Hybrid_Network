import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

export type InvoicePdfData = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  customer: { name: string; customerId: string; email: string; address: string; company: string };
  company: { name: string; address: string; email: string; phone: string };
  lineItems: { description: string; quantity: number; unit: string; unitPrice: number; amount: number }[];
  subtotal: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  usageSummary: { dataGB: number; voiceMin: number; sms: number } | null;
  paymentMethod?: string;
  paidDate?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontWeight: 700, color: "#059669" },
  brandSub: { fontSize: 8, color: "#6B7280", marginTop: 2 },
  invoiceTitle: { fontSize: 20, fontWeight: 700, textAlign: "right" },
  invoiceMeta: { fontSize: 9, color: "#4B5563", textAlign: "right", marginTop: 2 },
  statusPill: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 8,
    fontWeight: 700,
    color: "#ffffff",
  },
  section: { marginBottom: 18 },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  colBlock: { width: "48%" },
  label: { fontSize: 8, color: "#6B7280", textTransform: "uppercase", marginBottom: 3 },
  value: { fontSize: 10, marginBottom: 2 },
  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  th: { fontSize: 8, fontWeight: 700, color: "#374151", textTransform: "uppercase" },
  colDesc: { width: "46%" },
  colQty: { width: "12%", textAlign: "right" },
  colUnit: { width: "16%", textAlign: "right" },
  colAmount: { width: "26%", textAlign: "right" },
  totalsBlock: { marginTop: 14, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", width: 220, marginBottom: 4 },
  totalsLabel: { fontSize: 9, color: "#4B5563" },
  totalsValue: { fontSize: 9 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 220,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700 },
  grandTotalValue: { fontSize: 11, fontWeight: 700 },
  usageBox: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
  },
  usageTitle: { fontSize: 8, fontWeight: 700, color: "#374151", textTransform: "uppercase", marginBottom: 6 },
  usageRow: { flexDirection: "row", gap: 24 },
  usageStat: { fontSize: 9 },
  footer: { marginTop: 30, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  footerText: { fontSize: 8, color: "#6B7280", lineHeight: 1.5 },
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
}

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>HYBRID NETWORKS</Text>
            <Text style={styles.brandSub}>{data.company.address}</Text>
            <Text style={styles.brandSub}>
              {data.company.email} {data.company.phone ? `· ${data.company.phone}` : ""}
            </Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>{data.invoiceNumber}</Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[data.status] ?? "#6B7280" }]}>
              <Text>{data.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.colBlock}>
            <Text style={styles.label}>Billed To</Text>
            <Text style={styles.value}>{data.customer.name}</Text>
            {data.customer.company ? <Text style={styles.value}>{data.customer.company}</Text> : null}
            <Text style={styles.value}>{data.customer.address}</Text>
            <Text style={styles.value}>{data.customer.email}</Text>
            <Text style={styles.value}>Customer ID: {data.customer.customerId}</Text>
          </View>
          <View style={[styles.colBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.label}>Issue Date</Text>
            <Text style={styles.value}>{data.issueDate}</Text>
            <Text style={[styles.label, { marginTop: 8 }]}>Due Date</Text>
            <Text style={styles.value}>{data.dueDate}</Text>
            {data.paidDate ? (
              <>
                <Text style={[styles.label, { marginTop: 8 }]}>Paid Date</Text>
                <Text style={styles.value}>{data.paidDate}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit Price</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          {data.lineItems.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.colDesc, { fontSize: 9 }]}>{item.description}</Text>
              <Text style={[styles.colQty, { fontSize: 9 }]}>
                {item.quantity} {item.unit}
              </Text>
              <Text style={[styles.colUnit, { fontSize: 9 }]}>{money(item.unitPrice, data.currency)}</Text>
              <Text style={[styles.colAmount, { fontSize: 9 }]}>{money(item.amount, data.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{money(data.subtotal, data.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              {data.taxLabel} ({data.taxRate}%)
            </Text>
            <Text style={styles.totalsValue}>{money(data.taxAmount, data.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>{money(data.total, data.currency)}</Text>
          </View>
        </View>

        {data.usageSummary && (
          <View style={styles.usageBox}>
            <Text style={styles.usageTitle}>Usage Summary — Billing Period</Text>
            <View style={styles.usageRow}>
              <Text style={styles.usageStat}>Data Used: {data.usageSummary.dataGB.toFixed(2)} GB</Text>
              <Text style={styles.usageStat}>Voice Minutes: {data.usageSummary.voiceMin}</Text>
              <Text style={styles.usageStat}>SMS: {data.usageSummary.sms}</Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Payment instructions: Please settle this invoice by the due date via bank transfer to the
            account details provided by your account manager, or contact billing@hybridnetworks.com for
            other payment options. Thank you for your business.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// Silence @react-pdf's default Helvetica font registration warnings in some
// server environments by explicitly registering standard fonts if needed.
Font.registerHyphenationCallback((word) => [word]);
