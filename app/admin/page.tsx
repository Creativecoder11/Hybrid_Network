import Link from "next/link";
import { DollarSign, Receipt, Users, UserCheck, UploadCloud, ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getAdminDashboardStats } from "@/lib/dashboard/adminStats";
import { Card, CardContent } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { LabeledProgress, ProgressBar } from "@/components/ui/ProgressBar";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { OutstandingBillRowActions } from "@/components/admin/OutstandingBillRowActions";
import { formatCurrency, formatDate, formatPeriodMonth } from "@/lib/utils/format";



function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pctChange(current: number, previous: number): { value: string; positive: boolean } | undefined {
  if (previous === 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  return { value: `${Math.abs(change).toFixed(1)}%`, positive: change >= 0 };
}

export default async function AdminDashboardPage() {
  const user = await requireRole(["SUPER_ADMIN", "SUB_ADMIN"], "/portal");
  const stats = await getAdminDashboardStats();

  const maxPlanRevenue = Math.max(1, ...stats.revenueByPlan.map((p) => p.total));
  const maxUsageTypeRevenue = Math.max(1, ...stats.revenueByUsageType.map((p) => p.total));
  const maxTopCustomer = Math.max(1, ...stats.topCustomers.map((c) => c.total));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Admin Dashboard</p>
        <p className="mt-1 text-2xl font-bold">
          Welcome back, <span className="text-accent-green">{user.name.split(" ")[0]}</span>
        </p>
        <p className="mt-1 text-sm ">
          {formatDate(new Date().toISOString())} · Billing cycle closes in {stats.billingCycleDaysLeft} day
          {stats.billingCycleDaysLeft === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          icon="/assets/icons/Icon Container1.svg"
          tone="blue"
          trend={pctChange(stats.monthlyRevenue, stats.monthlyRevenuePrevMonth)}
          sublabel={formatPeriodMonth(currentPeriodMonth())}
          animatedBorder
        />
        <StatCard
          label="Outstanding Bills"
          value={String(stats.outstandingCount)}
          sublabel={`${formatCurrency(stats.outstandingAmount)} pending`}
          icon="/assets/icons/Icon Container2.svg"
          tone="red"
          animatedBorder
        />
        <StatCard
          label="Total Customers"
          value={String(stats.totalCustomers)}
          sublabel={`${formatCurrency(stats.outstandingAmount)} pending`}
          icon="/assets/icons/Icon Container3.svg"
          tone="blue"
          trend={pctChange(stats.totalCustomers, stats.totalCustomersPrevMonth)}
          animatedBorder
        />
        <StatCard
          label="Active Customers"
          value={String(stats.activeCustomers)}
          sublabel={`${stats.activeRate.toFixed(1)}% active rate`}
          icon="/assets/icons/Icon Container4.svg"
          tone="green"
          animatedBorder
        />
        <StatCard
          label="In Queue — CDR"
          value={stats.lastCdrBatch ? String(stats.lastCdrBatch.matchedRows) : "0"}
          sublabel={stats.lastCdrBatch ? stats.lastCdrBatch.status : "No uploads yet"}
          icon="/assets/icons/Icon Container5.svg"
          tone="purple"
          animatedBorder
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Revenue Overview</p>
              <p className="text-xs text-text-muted">Monthly collection</p>
            </div>
          </div>
          <RevenueChart data={stats.revenueSeries} />
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-text-primary">Top Customers</p>
          <p className="mb-4 text-xs text-text-muted">Highest spend this billing run</p>
          {stats.topCustomers.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">No billing activity yet this period.</p>
          ) : (
            <div className="space-y-4">
              {stats.topCustomers.map((c, i) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold text-text-secondary">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{c.name}</p>
                        <p className="text-xs text-text-muted">{c.planName || c.customerCode || "—"}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      {formatCurrency(c.total, c.currency)}
                    </span>
                  </div>
                  <ProgressBar value={c.total} max={maxTopCustomer} tone="green" className="mt-2" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Outstanding Bills</p>
              <p className="text-xs text-text-muted">Pending payments awaiting collection</p>
            </div>
            <Link
              href="/admin/billing"
              className="flex items-center gap-1.5 rounded-xl bg-accent-blue px-3.5 py-2 text-xs font-medium text-white hover:bg-accent-blue-strong"
            >
              View All Bills <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {stats.outstandingBills.length === 0 ? (
            <EmptyState title="No outstanding bills" description="Everything is paid up." />
          ) : (
            <TableContainer>
              <Table>
                <THead>
                  <TR>
                    <TH>
                      <Checkbox />
                    </TH>
                    <TH>Invoice</TH>
                    <TH>Customer</TH>
                    <TH>Product &amp; Service</TH>
                    <TH>Card Name</TH>
                    <TH>Period</TH>
                    <TH>Usage</TH>
                    <TH>Amount</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {stats.outstandingBills.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        <Checkbox />
                      </TD>
                      <TD className="font-medium text-text-primary">
                        <Link href={`/admin/billing/${b.id}`} className="hover:underline">
                          {b.invoiceNumber}
                        </Link>
                      </TD>
                      <TD>
                        <p className="text-text-primary">{b.customerName}</p>
                        {b.customerCode && <p className="text-xs text-accent-green">{b.customerCode}</p>}
                      </TD>
                      <TD>{b.vendor}</TD>
                      <TD>{b.cardName}</TD>
                      <TD>{formatPeriodMonth(b.periodMonth)}</TD>
                      <TD>{b.usageGB.toFixed(2)} GB</TD>
                      <TD>{formatCurrency(b.total, b.currency)}</TD>
                      <TD>
                        <Badge tone={b.status === "OVERDUE" ? "red" : "amber"}>{b.status}</Badge>
                      </TD>
                      <TD>
                        <OutstandingBillRowActions invoiceId={b.id} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-semibold text-text-primary">Revenue by Pricing Plan</p>
          <p className="mb-4 text-xs text-text-muted">Revenue contribution by customer pricing plan</p>
          {stats.revenueByPlan.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">No collections yet this month.</p>
          ) : (
            <div className="space-y-4">
              {stats.revenueByPlan.map((p) => (
                <LabeledProgress
                  key={p.planName}
                  label={p.planName}
                  value={p.total}
                  max={maxPlanRevenue}
                  displayValue={formatCurrency(p.total, p.currency)}
                  tone="green"
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-text-primary">Usage Revenue by Type</p>
          <p className="mb-4 text-xs text-text-muted">Rated usage charges by CDR category</p>
          {stats.revenueByUsageType.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">No collections yet this month.</p>
          ) : (
            <div className="space-y-4">
              {stats.revenueByUsageType.map((t) => (
                <LabeledProgress
                  key={t.label}
                  label={t.label}
                  value={t.total}
                  max={maxUsageTypeRevenue}
                  displayValue={formatCurrency(t.total)}
                  tone="blue"
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
