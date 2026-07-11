"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Eye,
  Trash2,
  Users,
  UserCheck,
  AlertTriangle,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import {
  TableContainer,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { CustomerFormModal } from "@/components/admin/CustomerFormModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { deleteCustomerAction } from "@/lib/actions/customers";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { CustomerRow, CustomerStats, PlanOption } from "@/lib/types/admin";

const STATUS_LABEL: Record<CustomerRow["status"], string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  INVITED: "Inactive",
};
const STATUS_TONE: Record<CustomerRow["status"], "green" | "amber" | "red"> = {
  ACTIVE: "green",
  SUSPENDED: "amber",
  INVITED: "red",
};

export function CustomersPageClient({
  rows,
  total,
  page,
  pageSize,
  q,
  status,
  sort,
  stats,
  plans,
  canDelete,
}: {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  status: string;
  sort: string;
  stats: CustomerStats;
  plans: PlanOption[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);

  function updateParams(next: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === "" || v === undefined) params.delete(k);
      else params.set(k, String(v));
    }
    if (!("page" in next)) params.set("page", "1");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== q) updateParams({ q: searchInput });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function openAdd() {
    setEditingCustomer(null);
    setModalOpen(true);
  }
  function openEdit(customer: CustomerRow) {
    setEditingCustomer(customer);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    const result = await deleteCustomerAction(deleteTarget.id);
    setDeletingId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Customer deleted.");
      setDeleteTarget(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">Customers</p>
          <p className="text-sm">
            Manage every customer account and subscription.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Add New Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Customers"
          value={String(stats.total)}
          icon="/assets/icons/Icon Container3.svg"
          animatedBorder
          sublabel={`${formatCurrency(stats.overdueAmount)} owed`}
          tone="blue"
        />
        <StatCard
          label="Active Customers"
          value={String(stats.active)}
          // sublabel={`${stats.activeRate.toFixed(1)}% active rate`}
          sublabel={`${formatCurrency(stats.overdueAmount)} owed`}
          icon="/assets/icons/Icon Container2.svg"
          animatedBorder
          tone="green"
        />
        <StatCard
          label="Overdue Accounts"
          value={String(stats.overdueCount)}
          sublabel={`${formatCurrency(stats.overdueAmount)} owed`}
          icon="/assets/icons/Icon Container1.svg"
          animatedBorder
          tone="red"
        />
        <StatCard
          label="Suspended Accounts"
          value={String(stats.suspended)}
          sublabel={`${stats.suspendedRate.toFixed(1)}% of base`}
          icon="/assets/icons/Icon Container1.svg"
          animatedBorder
          tone="amber"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            icon={<Search className="size-4" />}
            placeholder="Search by name, email, ID, or customer code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div>
          <Select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="sm:w-44"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INVITED">Inactive</option>
          </Select>
        </div>
        <div>
          <Select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="sm:w-44"
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name (A-Z)</option>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="Try adjusting your search or filters, or add a new customer."
          action={
            <Button onClick={openAdd} size="sm">
              <Plus className="size-4" />
              Add New Customer
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Account ID</TH>
                <TH>Customer</TH>
                <TH>Phone</TH>
                <TH>Joined</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD className="font-mono text-xs text-text-secondary">
                    {c.customerId || "--"}
                  </TD>
                  <TD>
                    <p className="font-medium text-text-primary">{c.name}</p>
                    {c.customerCode && (
                      <p className="text-xs font-medium text-accent-green">
                        {c.customerCode}
                      </p>
                    )}
                  </TD>
                  <TD className="text-text-secondary">{c.phone || "--"}</TD>
                  <TD className="text-text-secondary">
                    {formatDate(c.createdAt)}
                  </TD>
                  <TD>
                    {c.planName ? (
                      <Badge tone="blue">{c.planName}</Badge>
                    ) : (
                      <span className="text-text-muted">--</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[c.status]}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue"
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-text-primary"
                        aria-label="View"
                      >
                        <Eye className="size-4" />
                      </Link>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(c)}
                          disabled={deletingId === c.id}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-red/10 hover:text-red disabled:opacity-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => updateParams({ page: p })}
            onPageSizeChange={(size) =>
              updateParams({ pageSize: size, page: 1 })
            }
          />
        </TableContainer>
      )}

      {modalOpen && (
        <CustomerFormModal
          key={editingCustomer?.id ?? "new"}
          customer={editingCustomer}
          plans={plans}
          
          onClose={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name ?? "this customer"}?`}
        description="This customer and their account details will be permanently deleted and cannot be recovered."
        loading={!!deleteTarget && deletingId === deleteTarget.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
