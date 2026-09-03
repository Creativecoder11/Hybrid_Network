"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Receipt, Download, Eye } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  TableContainer,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatCurrency,
  formatDate,
  formatPeriodMonth,
} from "@/lib/utils/format";
import type { PortalInvoiceRow } from "@/lib/types/portal";

const STATUS_TONE: Record<
  PortalInvoiceRow["status"],
  "green" | "amber" | "red" | "neutral"
> = {
  DRAFT: "neutral",
  SENT: "amber",
  DUE: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELLED: "neutral",
};

export function PortalBillsClient({
  rows,
  status,
}: {
  rows: PortalInvoiceRow[];
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") params.delete("status");
    else params.set("status", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-bold text-text-primary">My Bills</p>
          <p className="text-sm text-text-muted">Your full invoice history.</p>
        </div>

        <Select
          value={status}
          onChange={(e) => updateStatus(e.target.value)}
          className="w-[200px]"
        >
          <option value="ALL">All statuses</option>
          <option value="DUE">Due</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PAID">Paid</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          description="Your invoices will appear here."
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Invoice #</TH>
                <TH>Period</TH>
                <TH>Issue Date</TH>
                <TH>Due Date</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((inv) => (
                <TR key={inv.id}>
                  <TD className="font-medium text-text-primary">
                    {inv.invoiceNumber}
                  </TD>
                  <TD>{formatPeriodMonth(inv.periodMonth)}</TD>
                  <TD className="text-text-secondary">
                    {formatDate(inv.issueDate)}
                  </TD>
                  <TD className="text-text-secondary">
                    {formatDate(inv.dueDate)}
                  </TD>
                  <TD>{formatCurrency(inv.total, inv.currency)}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <Link
                        href={`/portal/bills/${inv.id}`}
                        className="flex items-center gap-1 font-medium text-accent-blue hover:underline"
                      >
                        <Eye className="size-3.5" /> View
                      </Link>
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 font-medium text-accent-green hover:underline"
                      >
                        <Download className="size-3.5" /> PDF
                      </a>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
