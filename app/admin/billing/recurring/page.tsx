import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { RecurringInvoice } from "@/models/RecurringInvoice";
import { runDueRecurringInvoicesSafely } from "@/lib/billing/recurring";
import { issueDateForCycle } from "@/lib/billing/recurringSchedule";
import { getBillableCustomerOptions } from "@/lib/billing/billableOptions";
import { RecurringInvoicesClient } from "@/components/admin/RecurringInvoicesClient";
import type { RecurringInvoiceRow } from "@/lib/types/billing";

export const metadata: Metadata = {
  title: "Recurring Invoices | Hybrid Networks Admin",
};

export default async function RecurringInvoicesPage() {
  // Issue anything that has fallen due before showing the list.
  await runDueRecurringInvoicesSafely();
  await connectDB();

  const [schedules, customerOptions] = await Promise.all([
    RecurringInvoice.find().sort({ createdAt: -1 }).populate("customer", "name company").lean(),
    getBillableCustomerOptions(),
  ]);

  const rows: RecurringInvoiceRow[] = schedules.map((s) => {
    const customer = s.customer as unknown as { _id: { toString(): string }; name: string; company?: string } | null;
    return {
      id: s._id.toString(),
      customerId: customer?._id.toString() ?? "",
      customerName: customer ? customer.company || customer.name : "Deleted customer",
      accountNumber: s.accountNumber ?? "",
      description: s.description,
      amount: s.amount,
      currency: s.currency ?? "USD",
      termMonths: s.termMonths,
      cyclesGenerated: s.cyclesGenerated ?? 0,
      billingDay: s.billingDay,
      paymentTermsDays: s.paymentTermsDays ?? 14,
      autoSend: s.autoSend !== false,
      startDate: (s.startDate as Date).toISOString(),
      nextIssueDate: s.nextIssueDate ? (s.nextIssueDate as Date).toISOString() : null,
      endDate:
        s.status === "CANCELLED"
          ? null
          : issueDateForCycle(
              { anchorDate: s.anchorDate as Date, anchorCycle: s.anchorCycle ?? 0, billingDay: s.billingDay },
              s.termMonths - 1
            ).toISOString(),
      status: s.status,
      lastError: s.lastError ?? "",
      createdAt: (s.createdAt as Date | undefined)?.toISOString() ?? "",
    };
  });

  return <RecurringInvoicesClient rows={rows} customerOptions={customerOptions} />;
}
