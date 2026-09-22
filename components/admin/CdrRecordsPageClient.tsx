"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { GenerateInvoicesModal } from "@/components/admin/GenerateInvoicesModal";
import { generateInvoicesFromChargesAction } from "@/lib/actions/invoices";
import { assignChargeCustomerAction } from "@/lib/actions/cdrPricingImport";
import { AssignAccountControl, type AccountOption } from "@/components/admin/AssignAccountControl";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import type { CdrChargeRecordRow } from "@/lib/types/retailBilling";

export function CdrRecordsPageClient({
  records,
  status,
  q,
  batchOptions,
  batchId,
  accountOptions,
}: {
  records: CdrChargeRecordRow[];
  status: string;
  q: string;
  batchOptions: { id: string; fileName: string }[];
  batchId: string;
  accountOptions: AccountOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(q);
  const [generateOpen, setGenerateOpen] = useState(false);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectableIds = useMemo(
    () => records.filter((r) => r.status === "MATCHED" && !r.invoiceId && r.customerId).map((r) => r.id),
    [records]
  );

  function toggleAll() {
    if (selected.size === selectableIds.length && selectableIds.length > 0) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate(periodMonth: string, dueDate: string) {
    const result = await generateInvoicesFromChargesAction(Array.from(selected), periodMonth, dueDate);
    if (!result?.error) {
      toast.success(result?.success ?? "Invoices generated.");
      setSelected(new Set());
      router.refresh();
    }
    return result;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">CDR Records</p>
          <p className="text-sm">
            CDR charges across all imports — select allocated records to generate one invoice per Customer Account.
          </p>
        </div>
        {selected.size > 0 && (
          <Button onClick={() => setGenerateOpen(true)}>
            <Receipt className="size-4" />
            Generate Invoices ({selected.size})
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          icon={<Search className="size-4" />}
          placeholder="Search product code, account or customer..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParams({ q: searchInput });
          }}
          className="sm:w-72"
        />
        <Select value={status} onChange={(e) => updateParams({ status: e.target.value })} className="sm:w-44">
          <option value="ALL">All statuses</option>
          <option value="MATCHED">Allocated</option>
          <option value="UNMATCHED">Unallocated</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="INVALID">Invalid</option>
        </Select>
        <Select value={batchId} onChange={(e) => updateParams({ batchId: e.target.value })} className="sm:w-56">
          <option value="">All import batches</option>
          {batchOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.fileName}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => updateParams({ q: searchInput })}>
          Search
        </Button>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={FileText} title="No CDR records found" description="Import a CDR CSV to see priced records here." />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>
                  <Checkbox
                    checked={selectableIds.length > 0 && selected.size === selectableIds.length}
                    onChange={toggleAll}
                  />
                </TH>
                <TH>Product Code</TH>
                <TH>Customer Code / Account</TH>
                <TH>Wholesale</TH>
                <TH>Retail Plan</TH>
                <TH>Retail Charge</TH>
                <TH>Status</TH>
                <TH>Invoice</TH>
                <TH>Imported</TH>
              </TR>
            </THead>
            <TBody>
              {records.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Checkbox
                      checked={selected.has(r.id)}
                      disabled={!selectableIds.includes(r.id)}
                      onChange={() => toggleOne(r.id)}
                    />
                  </TD>
                  <TD className="font-mono text-xs">{r.identifier || "--"}</TD>
                  <TD>
                    <span className="font-mono text-xs">{r.customerCode || "--"}</span>
                    {r.customerName ? (
                      <Link href={`/admin/customers/${r.customerId}`} className="block text-xs text-accent-blue hover:underline">
                        {r.accountNumber ? `${r.accountNumber} · ` : ""}
                        {r.customerName}
                      </Link>
                    ) : r.status === "UNMATCHED" ? (
                      <div className="mt-1">
                        {r.unallocatedReason && <p className="mb-1 text-[11px] text-amber">{r.unallocatedReason}</p>}
                        <AssignAccountControl recordId={r.id} accounts={accountOptions} onAssign={assignChargeCustomerAction} />
                      </div>
                    ) : null}
                  </TD>
                  <TD>{formatCurrency(r.wholesaleAmount, r.currency)}</TD>
                  <TD>{r.retailPlanName || "--"}</TD>
                  <TD className="font-medium">
                    {r.status === "MATCHED" ? formatCurrency(r.retailAmount, r.currency) : "--"}
                  </TD>
                  <TD>
                    <Badge tone={r.status === "MATCHED" ? "green" : r.status === "UNMATCHED" ? "amber" : r.status === "DUPLICATE" ? "neutral" : "red"}>
                      {r.status === "MATCHED" ? "Allocated" : r.status === "UNMATCHED" ? "Unallocated" : r.status === "DUPLICATE" ? "Duplicate" : "Invalid"}
                    </Badge>
                  </TD>
                  <TD>
                    {r.invoiceId ? (
                      <Link href={`/admin/billing/${r.invoiceId}`} className="text-accent-blue hover:underline">
                        View
                      </Link>
                    ) : (
                      "--"
                    )}
                  </TD>
                  <TD className="text-text-secondary">{formatDateTime(r.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {generateOpen && (
        <GenerateInvoicesModal count={selected.size} onClose={() => setGenerateOpen(false)} onConfirm={handleGenerate} />
      )}
    </div>
  );
}
