import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { RecurringInvoice } from "@/models/RecurringInvoice";
import { Invoice } from "@/models/Invoice";
import { CustomerAccount } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { Settings } from "@/models/Settings";
import { roundCurrency } from "@/lib/billing/money";
import { scheduleSummary, toDateOnlyString } from "@/lib/billing/schedule";
import { RecurringInvoicesPageClient } from "@/components/admin/RecurringInvoicesPageClient";
import type { RecurringAccountOption, RecurringInvoiceRow } from "@/lib/types/billing";

export const metadata: Metadata = {
  title: "Recurring Invoices | Hybrid Networks Admin",
};

export default async function RecurringInvoicesPage() {
  await connectDB();

  const [schedules, accounts, subscriptions, settings] = await Promise.all([
    RecurringInvoice.find().sort({ createdAt: -1 }).lean(),
    CustomerAccount.find({ status: { $ne: "CLOSED" } }).select("customer accountNumber").sort({ accountNumber: 1 }).lean(),
    Subscription.find({ status: "ACTIVE", customerAccount: { $ne: null } }).sort({ createdAt: -1 }).populate("plan").lean(),
    Settings.findOne({ key: "GLOBAL" }).lean(),
  ]);

  const customerIds = Array.from(
    new Set([...accounts.map((a) => a.customer.toString()), ...schedules.map((s) => s.customer.toString())])
  );
  const [customers, invoices] = await Promise.all([
    User.find({ _id: { $in: customerIds } }).select("name company").lean(),
    Invoice.find({ recurringInvoice: { $in: schedules.map((s) => s._id) } })
      .select("invoiceNumber recurringInvoice recurringSequence status")
      .sort({ recurringSequence: 1 })
      .lean(),
  ]);
  const nameById = new Map(customers.map((c) => [c._id.toString(), c.company || c.name]));

  const planByAccount = new Map<string, { name: string; monthlyPrice: number; currency: string }>();
  for (const s of subscriptions) {
    const key = s.customerAccount?.toString();
    const plan = s.plan as unknown as { name: string; monthlyPrice: number; currency?: string } | null;
    if (key && plan && !planByAccount.has(key)) {
      planByAccount.set(key, { name: plan.name, monthlyPrice: plan.monthlyPrice, currency: plan.currency ?? "USD" });
    }
  }

  const accountOptions: RecurringAccountOption[] = accounts.map((a) => {
    const plan = planByAccount.get(a._id.toString());
    return {
      accountId: a._id.toString(),
      accountNumber: a.accountNumber,
      customerName: nameById.get(a.customer.toString()) ?? "Unknown customer",
      planName: plan?.name ?? "",
      planMonthlyPrice: plan?.monthlyPrice ?? null,
      currency: plan?.currency ?? settings?.currency ?? "USD",
    };
  });

  const rows: RecurringInvoiceRow[] = schedules.map((s) => {
    const summary = scheduleSummary(s.startDate, s.durationMonths);
    const taxAmount = roundCurrency(s.subtotal * (s.taxRate / 100));
    return {
      id: s._id.toString(),
      customerId: s.customer.toString(),
      customerName: nameById.get(s.customer.toString()) ?? "Unknown customer",
      accountNumber: s.accountNumber,
      lineItems: s.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity ?? 1,
        unit: li.unit ?? "",
        unitPrice: li.unitPrice ?? 0,
        amount: li.amount ?? 0,
      })),
      subtotal: s.subtotal,
      taxRate: s.taxRate,
      taxLabel: s.taxLabel ?? "GST",
      totalPerInvoice: roundCurrency(s.subtotal + taxAmount),
      currency: s.currency ?? "USD",
      startDate: toDateOnlyString(s.startDate),
      endDate: toDateOnlyString(summary.endDate),
      durationMonths: s.durationMonths,
      dueDays: s.dueDays ?? 14,
      invoicesGenerated: s.invoicesGenerated ?? 0,
      nextInvoiceDate: s.nextInvoiceDate ? toDateOnlyString(s.nextInvoiceDate) : null,
      status: s.status,
      notes: s.notes ?? "",
      invoices: invoices
        .filter((inv) => inv.recurringInvoice?.toString() === s._id.toString())
        .map((inv) => ({
          id: inv._id.toString(),
          invoiceNumber: inv.invoiceNumber,
          sequence: inv.recurringSequence ?? 0,
          status: inv.status,
        })),
    };
  });

  return (
    <RecurringInvoicesPageClient
      rows={rows}
      accountOptions={accountOptions}
      defaultTaxRate={settings?.taxRate ?? 0}
      taxLabel={settings?.taxLabel ?? "GST"}
      cronEnabled={Boolean(process.env.CRON_SECRET)}
    />
  );
}
