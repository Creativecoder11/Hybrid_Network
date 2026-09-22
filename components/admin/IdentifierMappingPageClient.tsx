"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, AlertTriangle, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Card, CardContent } from "@/components/ui/Card";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { IdentifierMappingFormModal } from "@/components/admin/IdentifierMappingFormModal";
import {
  toggleCdrMappingActiveAction,
  deleteCdrMappingAction,
} from "@/lib/actions/cdrMappings";
import { formatDateTime } from "@/lib/utils/format";
import type { CdrIdentifierMappingRow } from "@/lib/types/retailBilling";

export type UnmappedIdentifierRow = {
  identifier: string;
  recordCount: number;
  totalWholesaleAmount: number;
  currency: string;
  /** The code exists and is active but has no Retail Plan (retail pricing). */
  hasPricingOnly: boolean;
};

const TYPE_LABEL: Record<CdrIdentifierMappingRow["productType"], string> = {
  CALL: "Call",
  SMS: "SMS",
  DATA: "Data",
  SERVICE: "Service",
  OTHER: "Other",
};

export function IdentifierMappingPageClient({
  mappings,
  unmapped,
  retailPlans,
  canDelete,
}: {
  mappings: CdrIdentifierMappingRow[];
  unmapped: UnmappedIdentifierRow[];
  retailPlans: { id: string; name: string; isActive: boolean }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CdrIdentifierMappingRow | null>(null);
  const [prefillIdentifier, setPrefillIdentifier] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CdrIdentifierMappingRow | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return mappings.filter((m) => {
      if (statusFilter === "ACTIVE" && !m.isActive) return false;
      if (statusFilter === "INACTIVE" && m.isActive) return false;
      if (!needle) return true;
      return (
        m.identifier.toLowerCase().includes(needle) ||
        m.name.toLowerCase().includes(needle) ||
        m.category.toLowerCase().includes(needle) ||
        m.retailPlanName.toLowerCase().includes(needle)
      );
    });
  }, [mappings, search, statusFilter]);

  function openCreate(identifier?: string) {
    setEditingMapping(null);
    setPrefillIdentifier(identifier);
    setModalOpen(true);
  }

  async function handleToggle(m: CdrIdentifierMappingRow) {
    setBusyId(m.id);
    const result = await toggleCdrMappingActiveAction(m.id, !m.isActive);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Updated.");
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const result = await deleteCdrMappingAction(deleteTarget.id);
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Deleted.");
      setDeleteTarget(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">Product Codes</p>
          <p className="text-sm">
            CDR records are allocated only when their Product Code is listed and active here. Optionally link a Retail
            Plan to price the product in retail CDR imports.
          </p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="size-4" />
          Add Product Code
        </Button>
      </div>

      {unmapped.length > 0 && (
        <Card className="border-amber/30 bg-amber/5">
          <CardContent className="pt-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber">
              <AlertTriangle className="size-3.5" />
              Product Codes blocking allocation ({unmapped.length})
            </p>
            <div className="space-y-2">
              {unmapped.map((u) => (
                <div
                  key={u.identifier}
                  className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-text-primary">{u.identifier}</p>
                    <p className="text-xs text-text-muted">
                      {u.recordCount} unallocated record{u.recordCount === 1 ? "" : "s"}
                      {u.totalWholesaleAmount > 0 ? ` · ${u.totalWholesaleAmount.toFixed(2)} ${u.currency} wholesale` : ""}
                      {u.hasPricingOnly ? " · needs a Retail Plan" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const existing = u.hasPricingOnly
                        ? mappings.find((m) => m.isActive && m.identifier.toLowerCase() === u.identifier.toLowerCase())
                        : undefined;
                      if (existing) {
                        setEditingMapping(existing);
                        setPrefillIdentifier(undefined);
                        setModalOpen(true);
                      } else openCreate(u.identifier);
                    }}
                  >
                    <Link2Off className="size-3.5" />
                    {u.hasPricingOnly ? "Set Pricing" : "Add Code"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            icon={<Search className="size-4" />}
            placeholder="Search code, name, category or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-72"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-40">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Link2Off}
            title="No Product Codes found"
            description="Add the Product Codes that appear on your CDR files. Records with unknown codes stay unallocated."
            action={
              <Button size="sm" onClick={() => openCreate()}>
                <Plus className="size-4" />
                Add Product Code
              </Button>
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH>Product Code</TH>
                  <TH>Name / Category</TH>
                  <TH>Type</TH>
                  <TH>Pricing (Retail Plan)</TH>
                  <TH>Status</TH>
                  <TH>Updated</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-mono text-sm font-medium text-text-primary">{m.identifier}</TD>
                    <TD>
                      <p className="text-text-primary">{m.name || "--"}</p>
                      {m.category && <p className="text-xs text-text-muted">{m.category}</p>}
                    </TD>
                    <TD>
                      <Badge tone="blue">{TYPE_LABEL[m.productType]}</Badge>
                    </TD>
                    <TD>
                      {m.retailPlanId ? (
                        <>
                          <p className="text-text-primary">{m.retailPlanName}</p>
                          <p className="text-xs text-text-secondary">{m.pricingValueLabel}</p>
                          {!m.retailPlanActive && (
                            <Badge tone="amber" className="mt-1">
                              Plan inactive
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-text-muted">No pricing rule</span>
                      )}
                    </TD>
                    <TD>
                      <Switch checked={m.isActive} onChange={() => handleToggle(m)} disabled={busyId === m.id} />
                    </TD>
                    <TD className="text-text-secondary">{formatDateTime(m.updatedAt)}</TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingMapping(m);
                            setPrefillIdentifier(undefined);
                            setModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue"
                          aria-label="Edit"
                        >
                          <Pencil className="size-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(m)}
                            disabled={busyId === m.id}
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
          </TableContainer>
        )}
      </div>

      {modalOpen && (
        <IdentifierMappingFormModal
          key={editingMapping?.id ?? prefillIdentifier ?? "new"}
          mapping={editingMapping}
          prefillIdentifier={prefillIdentifier}
          retailPlans={retailPlans}
          onClose={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete Product Code "${deleteTarget?.identifier ?? ""}"?`}
        description="The code will be permanently deleted (deactivate it instead to keep history). Already-processed CDR records keep their original allocation and pricing snapshot; new records with this code become unallocated."
        loading={!!deleteTarget && busyId === deleteTarget.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
