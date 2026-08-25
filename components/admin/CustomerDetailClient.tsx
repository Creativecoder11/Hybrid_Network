"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Pencil,
  Mail,
  Ban,
  CheckCircle2,
  Trash2,
  ArrowLeft,
  Wifi,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomerFormModal } from "@/components/admin/CustomerFormModal";
import { UsageHistoryEditModal } from "@/components/admin/UsageHistoryEditModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import {
  deleteCustomerAction,
  resendInviteAction,
  suspendCustomerAction,
  reactivateCustomerAction,
} from "@/lib/actions/customers";
import { displayOrDash, formatCurrency, formatDate, formatDateTime, formatPeriodMonth } from "@/lib/utils/format";
import type {
  ActivityLogRow,
  CdrRecordRow,
  CustomerDetail,
  InvoiceRow,
  PlanOption,
  UsageHistoryRow,
} from "@/lib/types/admin";

const STATUS_LABEL: Record<CustomerDetail["status"], string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  INVITED: "Inactive",
};
const STATUS_TONE: Record<CustomerDetail["status"], "green" | "amber" | "red"> = {
  ACTIVE: "green",
  SUSPENDED: "amber",
  INVITED: "red",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-2.5 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-primary">{displayOrDash(value)}</span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  pending,
  tone = "neutral",
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  pending?: boolean;
  tone?: "neutral" | "red";
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
        tone === "red" ? "text-red hover:bg-red/10" : "text-text-secondary hover:bg-surface-raised"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

export function CustomerDetailClient({
  customer,
  usageHistory,
  invoices,
  cdrRecords,
  activity,
  plans,
  canDelete,
}: {
  customer: CustomerDetail;
  usageHistory: UsageHistoryRow[];
  invoices: InvoiceRow[];
  cdrRecords: CdrRecordRow[];
  activity: ActivityLogRow[];
  plans: PlanOption[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editingUsage, setEditingUsage] = useState<UsageHistoryRow | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function runAction(name: string, fn: () => Promise<{ error?: string; success?: string } | undefined>) {
    setPendingAction(name);
    const result = await fn();
    setPendingAction(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Done.");
      router.refresh();
    }
  }

  async function handleDelete() {
    setPendingAction("delete");
    const result = await deleteCustomerAction(customer.id);
    setPendingAction(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Customer deleted.");
      router.push("/admin/customers");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Back to Customers
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xl font-bold">{customer.name}</p>
            <Badge tone={STATUS_TONE[customer.status]}>{STATUS_LABEL[customer.status]}</Badge>
          </div>
          <span className="mt-1 text-sm text-text-muted">
            {customer.customerId} {customer.customerCode && `· ${customer.customerCode}`} · {customer.email}
          </span>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" />
          Edit Customer
        </Button>
      </div>

      <Tabs
        tabs={[
          {
            key: "profile",
            label: "Profile",
            content: (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">
                      User Information
                    </p>
                    <InfoRow label="Account Type" value={customer.accountType?.replace(/_/g, " / ")} />
                    <InfoRow label="Contact Person" value={customer.contactPerson} />
                    <InfoRow label="NID / Trade License" value={customer.nidTradeLicense} />
                    <InfoRow label="Phone" value={customer.phone} />
                    <InfoRow label="Address" value={customer.address} />
                    <InfoRow label="Company" value={customer.company} />
                    <InfoRow label="Customer Code" value={customer.customerCode} />
                    <InfoRow label="Card Name" value={customer.cardName} />
                    <InfoRow label="ICCID" value={customer.iccid} />
                    <InfoRow label="IMEI" value={customer.imei} />
                    <InfoRow label="Service" value={customer.service} />
                    <InfoRow label="Vendor" value={customer.vendor} />
                    <InfoRow label="Starlink Vessel ID" value={customer.starlinkVesselId} />
                    <InfoRow label="Starlink Service Line" value={customer.starlinkServiceLineNumber} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">
                      Network Information
                    </p>
                    <InfoRow label="Origin Number" value={customer.network.originNumber} />
                    <InfoRow label="Origin Country" value={customer.network.originCountry} />
                    <InfoRow label="Origin IP Address" value={customer.network.originIpAddress} />
                    <InfoRow label="Origin Region" value={customer.network.originRegion} />
                    <InfoRow label="Origin State" value={customer.network.originState} />
                    <InfoRow label="Destination Number" value={customer.network.destinationNumber} />
                    <InfoRow label="Destination Network" value={customer.network.destinationNetwork} />
                    <InfoRow label="Destination Country" value={customer.network.destinationCountry} />
                    <InfoRow label="Destination State" value={customer.network.destinationState} />
                  </CardContent>
                </Card>
                {customer.usage && (
                  <Card className="lg:col-span-2">
                    <CardContent className="pt-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">
                        Usage This Period
                      </p>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-text-muted">Data Used</p>
                          <p className="text-lg font-semibold text-text-primary">
                            {customer.usage.volumeDataGB.toFixed(2)} GB
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">In Bundle</p>
                          <p className="text-lg font-semibold text-text-primary">
                            {customer.usage.volumeInBundleGB.toFixed(2)} GB
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Voice Minutes</p>
                          <p className="text-lg font-semibold text-text-primary">{customer.usage.volumeMin}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">SMS</p>
                          <p className="text-lg font-semibold text-text-primary">{customer.usage.volumeMsg}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: "subscriptions",
            label: "Subscriptions & Plans",
            content:
              customer.subscriptions.length === 0 ? (
                <EmptyState icon={Wifi} title="No subscriptions" description="This customer has no plan assigned yet." />
              ) : (
                <TableContainer>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Plan</TH>
                        <TH>Provider</TH>
                        <TH>Price</TH>
                        <TH>Static IP</TH>
                        <TH>Terminal IDs</TH>
                        <TH>Start</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {customer.subscriptions.map((s) => (
                        <TR key={s.id}>
                          <TD className="font-medium text-text-primary">{s.planName}</TD>
                          <TD>{s.planProvider}</TD>
                          <TD>{formatCurrency(s.monthlyPrice, s.currency)}/mo</TD>
                          <TD className="font-mono text-xs">{displayOrDash(s.staticIp)}</TD>
                          <TD className="font-mono text-xs">{s.terminalIds.join(", ") || "--"}</TD>
                          <TD>{formatDate(s.startDate)}</TD>
                          <TD>
                            <Badge tone={s.status === "ACTIVE" ? "green" : s.status === "PAUSED" ? "amber" : "neutral"}>
                              {s.status}
                            </Badge>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableContainer>
              ),
          },
          {
            key: "usage",
            label: "Usage History",
            content:
              usageHistory.length === 0 ? (
                <EmptyState
                  icon={Radio}
                  title="No usage history"
                  description="Usage will appear here after a CDR upload or manual entry."
                />
              ) : (
                <TableContainer>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Period</TH>
                        <TH>Data Used</TH>
                        <TH>In Bundle</TH>
                        <TH>Voice Min</TH>
                        <TH>SMS</TH>
                        <TH>Source</TH>
                        <TH className="text-right">Actions</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {usageHistory.map((u) => (
                        <TR key={u.periodMonth}>
                          <TD className="font-medium text-text-primary">{formatPeriodMonth(u.periodMonth)}</TD>
                          <TD>{u.volumeDataGB.toFixed(2)} GB</TD>
                          <TD>{u.volumeInBundleGB.toFixed(2)} GB</TD>
                          <TD>{u.volumeMin}</TD>
                          <TD>{u.volumeMsg}</TD>
                          <TD>
                            <Badge tone={u.source === "CDR" ? "blue" : u.source === "MANUAL" ? "amber" : "green"}>
                              {u.source}
                            </Badge>
                          </TD>
                          <TD className="text-right">
                            <button
                              onClick={() => setEditingUsage(u)}
                              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue"
                              aria-label="Edit usage"
                            >
                              <Pencil className="size-4" />
                            </button>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableContainer>
              ),
          },
          {
            key: "invoices",
            label: "Invoices",
            content:
              invoices.length === 0 ? (
                <EmptyState title="No invoices yet" description="Invoices generated for this customer will appear here." />
              ) : (
                <TableContainer>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Invoice #</TH>
                        <TH>Period</TH>
                        <TH>Issue Date</TH>
                        <TH>Due Date</TH>
                        <TH>Total</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {invoices.map((inv) => (
                        <TR key={inv.id}>
                          <TD className="font-medium text-text-primary">
                            <Link href={`/admin/billing/${inv.id}`} className="text-accent-blue hover:underline">
                              {inv.invoiceNumber}
                            </Link>
                          </TD>
                          <TD>{formatPeriodMonth(inv.periodMonth)}</TD>
                          <TD>{formatDate(inv.issueDate)}</TD>
                          <TD>{formatDate(inv.dueDate)}</TD>
                          <TD>{formatCurrency(inv.total, inv.currency)}</TD>
                          <TD>
                            <Badge
                              tone={
                                inv.status === "PAID"
                                  ? "green"
                                  : inv.status === "OVERDUE"
                                    ? "red"
                                    : inv.status === "DUE" || inv.status === "SENT"
                                      ? "amber"
                                      : "neutral"
                              }
                            >
                              {inv.status}
                            </Badge>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableContainer>
              ),
          },
          {
            key: "cdr",
            label: "Raw CDR Records",
            content:
              cdrRecords.length === 0 ? (
                <EmptyState
                  title="No CDR records"
                  description="Raw daily CDR rows for this customer will appear here after a CDR file is uploaded and matched."
                />
              ) : (
                <TableContainer>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Date</TH>
                        <TH>CDR ID</TH>
                        <TH>Period</TH>
                        <TH>Card Name</TH>
                        <TH>Service</TH>
                        <TH>Data Volume</TH>
                        <TH>Total Volume</TH>
                        <TH>Price</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {cdrRecords.map((r) => (
                        <TR key={r.id}>
                          <TD>{r.startCdr ? formatDate(r.startCdr) : "--"}</TD>
                          <TD className="font-mono text-xs">{r.cdrId}</TD>
                          <TD>{formatPeriodMonth(r.period)}</TD>
                          <TD>{displayOrDash(r.cardName)}</TD>
                          <TD>{displayOrDash(r.service)}</TD>
                          <TD>{r.volumeDataGB.toFixed(2)} GB</TD>
                          <TD>{r.volumeTotalGB.toFixed(2)} GB</TD>
                          <TD>{formatCurrency(r.priceTotal, r.currency)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableContainer>
              ),
          },
          {
            key: "activity",
            label: "Activity Log",
            content:
              activity.length === 0 ? (
                <EmptyState title="No activity yet" />
              ) : (
                <div className="space-y-2">
                  {activity.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-text-primary">{a.action.replace(/_/g, " ")}</p>
                        <p className="text-xs text-text-muted">by {a.actorName}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-text-muted">{formatDateTime(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ),
          },
          {
            key: "actions",
            label: "Actions",
            content: (
              <div className="max-w-sm space-y-3">
                {customer.status !== "ACTIVE" && (
                  <ActionButton
                    icon={Mail}
                    label="Resend Invitation"
                    pending={pendingAction === "resend"}
                    onClick={() => runAction("resend", () => resendInviteAction(customer.id))}
                  />
                )}
                {customer.status !== "SUSPENDED" ? (
                  <ActionButton
                    icon={Ban}
                    label="Suspend Customer"
                    pending={pendingAction === "suspend"}
                    onClick={() => runAction("suspend", () => suspendCustomerAction(customer.id))}
                  />
                ) : (
                  <ActionButton
                    icon={CheckCircle2}
                    label="Reactivate Customer"
                    pending={pendingAction === "reactivate"}
                    onClick={() => runAction("reactivate", () => reactivateCustomerAction(customer.id))}
                  />
                )}
                {canDelete && (
                  <ActionButton
                    icon={Trash2}
                    label="Delete Customer"
                    tone="red"
                    pending={pendingAction === "delete"}
                    onClick={() => setDeleteOpen(true)}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      {editOpen && (
        <CustomerFormModal customer={customer} plans={plans} onClose={() => {
          setEditOpen(false);
          router.refresh();
        }} />
      )}
      {editingUsage && (
        <UsageHistoryEditModal
          customerId={customer.id}
          usage={editingUsage}
          onClose={() => {
            setEditingUsage(null);
            router.refresh();
          }}
        />
      )}

      <DeleteConfirmModal
        open={deleteOpen}
        title={`Delete ${customer.name}?`}
        description="This customer and their account details will be permanently deleted and cannot be recovered."
        loading={pendingAction === "delete"}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
