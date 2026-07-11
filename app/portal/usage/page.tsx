import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { connectDB } from "@/lib/db/connect";
import { UsageRecord } from "@/models/UsageRecord";
import { requireRole } from "@/lib/auth/dal";
import { Card } from "@/components/ui/Card";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsageChart } from "@/components/portal/UsageChart";
import { formatPeriodMonth } from "@/lib/utils/format";
import type { PortalUsageHistoryRow } from "@/lib/types/portal";

export const metadata: Metadata = {
  title: "Usage | Hybrid Networks Portal",
};

const GB = 1_000_000_000;

export default async function PortalUsagePage() {
  const user = await requireRole(["CUSTOMER"], "/admin");

  await connectDB();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoff = `${twelveMonthsAgo.getFullYear()}${String(twelveMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

  const records = await UsageRecord.find({ customer: user.id, periodMonth: { $gte: cutoff } })
    .sort({ periodMonth: 1 })
    .lean();

  const rows: PortalUsageHistoryRow[] = records.map((r) => ({
    periodMonth: r.periodMonth,
    volumeDataGB: Math.round(((r.volumeDataBytes ?? 0) / GB) * 100) / 100,
    volumeMin: r.volumeMin ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Usage</h1>
        <p className="text-sm text-text-muted">Your data and voice usage over the last 12 months.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No usage history yet" />
      ) : (
        <>
          <Card className="p-5">
            <UsageChart data={rows} />
          </Card>

          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH>Data Used</TH>
                  <TH>Voice Minutes</TH>
                </TR>
              </THead>
              <TBody>
                {[...rows].reverse().map((r) => (
                  <TR key={r.periodMonth}>
                    <TD className="font-medium text-text-primary">{formatPeriodMonth(r.periodMonth)}</TD>
                    <TD>{r.volumeDataGB.toFixed(2)} GB</TD>
                    <TD>{r.volumeMin}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </>
      )}
    </div>
  );
}
