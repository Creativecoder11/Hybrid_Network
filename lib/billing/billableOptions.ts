import "server-only";
import { connectDB } from "@/lib/db/connect";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { buildPlanSpecLabel } from "@/lib/billing/billingStats";
import type { BillableCustomerOption } from "@/lib/types/billing";

/** One option per Customer Account with an active subscription. */
export async function getBillableCustomerOptions(): Promise<BillableCustomerOption[]> {
  await connectDB();
  const customers = await User.find(CUSTOMER_PROFILE_FILTER).sort({ name: 1 }).lean();
  const customerById = new Map(customers.map((c) => [c._id.toString(), c]));

  const activeSubs = await Subscription.find({
    customer: { $in: customers.map((c) => c._id) },
    status: "ACTIVE",
  })
    .populate("plan")
    .populate("customerAccount", "accountNumber")
    .lean();

  return activeSubs
    .filter((s) => s.customerAccount && s.plan && customerById.has(s.customer.toString()))
    .map((s) => {
      const c = customerById.get(s.customer.toString())!;
      const account = s.customerAccount as unknown as { _id: { toString(): string }; accountNumber: string };
      const plan = s.plan as unknown as {
        _id: string;
        name: string;
        provider: string;
        monthlyPrice: number;
        currency: string;
        speedMbps?: number | null;
        sharedRatio?: string | null;
        dataAllowanceGB?: number | null;
      };
      return {
        id: c._id.toString(),
        accountId: account._id.toString(),
        label: `${c.name} (${account.accountNumber})`,
        customerCode: account.accountNumber,
        customerSince: (c.createdAt as Date).toISOString(),
        planId: plan._id.toString(),
        planName: plan.name,
        planProvider: plan.provider,
        planSpecLabel: buildPlanSpecLabel(plan),
        planMonthlyPrice: plan.monthlyPrice,
        planCurrency: plan.currency ?? "USD",
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
