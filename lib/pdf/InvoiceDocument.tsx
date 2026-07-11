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
  lastInvoices?: { periodMonth: string; total: number }[];
};

const BLUE = "#0f6fd6";
const BLUE_DARK = "#0b3f7a";
const INK = "#111827";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 18, fontWeight: 700, color: BLUE_DARK },
  brandSub: { fontSize: 8, color: "#6B7280", marginTop: 2 },
  invoiceTitle: { fontSize: 16, fontWeight: 700, textAlign: "right", color: INK },
  invoiceTitleSub: { fontSize: 8, color: BLUE, textAlign: "right", marginTop: 2 },
  headerDivider: { marginTop: 14, marginBottom: 18, height: 2, backgroundColor: BLUE },

  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  colBlock: { width: "46%" },
  label: { fontSize: 7.5, color: "#6B7280", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  value: { fontSize: 9.5, marginBottom: 2 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  metaLabel: { fontSize: 8.5, color: "#6B7280" },
  metaValue: { fontSize: 8.5, fontWeight: 700, color: INK },

  statusPill: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 7.5,
    fontWeight: 700,
    color: "#ffffff",
  },

  panelRow: { flexDirection: "row", gap: 16 },
  chargesPanel: { width: "58%", borderWidth: 1, borderColor: "#DBEAFE", borderRadius: 4, overflow: "hidden" },
  chargesHeader: { backgroundColor: BLUE, paddingVertical: 8, paddingHorizontal: 10 },
  chargesHeaderText: { fontSize: 11, fontWeight: 700, color: "#ffffff" },
  chargesBody: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  chargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EFF6FF",
  },
  chargeDesc: { fontSize: 8.5, width: "70%" },
  chargeAmount: { fontSize: 8.5, width: "30%", textAlign: "right" },
  totalsWrap: { paddingHorizontal: 10, paddingBottom: 10, marginTop: 4 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 8.5, color: "#4B5563" },
  totalsValue: { fontSize: 8.5 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: "#EFF6FF",
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700, color: BLUE_DARK },
  grandTotalValue: { fontSize: 13, fontWeight: 700, color: BLUE_DARK },

  sidePanel: { width: "42%" },
  infoBox: { marginBottom: 12 },
  infoBoxTitle: { fontSize: 9, fontWeight: 700, color: INK, marginBottom: 4 },
  infoBoxText: { fontSize: 8, color: "#4B5563", lineHeight: 1.5 },
  contactRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  contactLabel: { fontSize: 8, color: "#6B7280" },
  contactValue: { fontSize: 8, color: INK },

  barRow: { marginTop: 6 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  barLabel: { fontSize: 7.5, color: "#6B7280" },
  barValue: { fontSize: 7.5, color: INK },
  barTrack: { height: 5, backgroundColor: "#E5F9F0", borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, backgroundColor: "#10B981", borderRadius: 3 },

  usageBox: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
  },
  usageTitle: { fontSize: 8, fontWeight: 700, color: "#374151", textTransform: "uppercase", marginBottom: 6 },
  usageRow: { flexDirection: "row", gap: 24 },
  usageStat: { fontSize: 9 },

  paymentPanel: {
    marginTop: 16,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 12,
    gap: 20,
  },
  paymentCol: { flex: 1 },
  paymentTitle: { fontSize: 8.5, fontWeight: 700, color: INK, marginBottom: 4 },
  paymentText: { fontSize: 8, color: "#4B5563", lineHeight: 1.5 },

  footerBanner: {
    marginTop: 18,
    backgroundColor: BLUE_DARK,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerTagline: { fontSize: 9, color: "#ffffff", width: "70%", lineHeight: 1.4 },
  footerBrand: { fontSize: 11, fontWeight: 700, color: "#ffffff" },

  regFooter: { marginTop: 10, fontSize: 6.5, color: "#9CA3AF", textAlign: "center" },
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

function formatPeriodLabel(periodMonth: string) {
  if (!periodMonth || periodMonth.length !== 6) return periodMonth;
  const year = periodMonth.slice(0, 4);
  const month = Number(periodMonth.slice(4, 6));
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[month - 1] ?? ""} ${year}`;
}

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const lastInvoices = data.lastInvoices ?? [];
  const maxLastInvoice = Math.max(1, ...lastInvoices.map((i) => i.total));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{data.company.name.toUpperCase()}</Text>
            <Text style={styles.brandSub}>{data.company.address || "ISP Distributor Portal"}</Text>
            <Text style={styles.brandSub}>
              {data.company.email} {data.company.phone ? `· ${data.company.phone}` : ""}
            </Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceTitleSub}>{data.invoiceNumber}</Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[data.status] ?? "#6B7280" }]}>
              <Text>{data.status}</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.twoCol}>
          <View style={styles.colBlock}>
            <Text style={styles.label}>Billed To</Text>
            <Text style={styles.value}>{data.customer.name}</Text>
            {data.customer.company ? <Text style={styles.value}>{data.customer.company}</Text> : null}
            <Text style={styles.value}>{data.customer.address}</Text>
            <Text style={styles.value}>{data.customer.email}</Text>
          </View>
          <View style={styles.colBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice Number</Text>
              <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice Date</Text>
              <Text style={styles.metaValue}>{data.issueDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Due Date</Text>
              <Text style={styles.metaValue}>{data.dueDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Customer ID</Text>
              <Text style={styles.metaValue}>{data.customer.customerId || "--"}</Text>
            </View>
            {data.paidDate ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Paid Date</Text>
                <Text style={styles.metaValue}>{data.paidDate}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.panelRow}>
          <View style={styles.chargesPanel}>
            <View style={styles.chargesHeader}>
              <Text style={styles.chargesHeaderText}>Charges</Text>
            </View>
            <View style={styles.chargesBody}>
              {data.lineItems.map((item, i) => (
                <View style={styles.chargeRow} key={i}>
                  <Text style={styles.chargeDesc}>{item.description}</Text>
                  <Text style={styles.chargeAmount}>{money(item.amount, data.currency)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.totalsWrap}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Net Amount</Text>
                <Text style={styles.totalsValue}>{money(data.subtotal, data.currency)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  {data.taxLabel} @ {data.taxRate.toFixed(2)}%
                </Text>
                <Text style={styles.totalsValue}>{money(data.taxAmount, data.currency)}</Text>
              </View>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total Due</Text>
              <Text style={styles.grandTotalValue}>{money(data.total, data.currency)}</Text>
            </View>
          </View>

          <View style={styles.sidePanel}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Want to know more?</Text>
              <Text style={styles.infoBoxText}>
                Sign in to your customer portal for a detailed summary of your invoice and usage history.
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Questions about your invoice?</Text>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>{data.company.email}</Text>
              </View>
              {data.company.phone ? (
                <View style={styles.contactRow}>
                  <Text style={styles.contactLabel}>Phone</Text>
                  <Text style={styles.contactValue}>{data.company.phone}</Text>
                </View>
              ) : null}
            </View>

            {lastInvoices.length > 0 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>Last {lastInvoices.length} Invoices</Text>
                {lastInvoices.map((inv, i) => (
                  <View style={styles.barRow} key={i}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>{formatPeriodLabel(inv.periodMonth)}</Text>
                      <Text style={styles.barValue}>{money(inv.total, data.currency)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(4, (inv.total / maxLastInvoice) * 100)}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}
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

        <View style={styles.paymentPanel}>
          <View style={styles.paymentCol}>
            <Text style={styles.paymentTitle}>Payment Method</Text>
            <Text style={styles.paymentText}>
              {data.paymentMethod ? data.paymentMethod : "Bank Transfer"}. Please reference your invoice number
              when making payment.
            </Text>
          </View>
          <View style={styles.paymentCol}>
            <Text style={styles.paymentTitle}>Payment Details</Text>
            <Text style={styles.paymentText}>
              Contact {data.company.email} for our bank account details, or settle this invoice directly from
              your customer portal.
            </Text>
          </View>
        </View>

        <View style={styles.footerBanner}>
          <Text style={styles.footerTagline}>
            Providing trusted and reliable connectivity solutions for people, systems, and assets — wherever your
            business operates.
          </Text>
          <Text style={styles.footerBrand}>{data.company.name.toUpperCase()}</Text>
        </View>

        <Text style={styles.regFooter}>
          {data.company.name} · {data.company.address}
        </Text>
      </Page>
    </Document>
  );
}

// Silence @react-pdf's default Helvetica font registration warnings in some
// server environments by explicitly registering standard fonts if needed.
Font.registerHyphenationCallback((word) => [word]);
