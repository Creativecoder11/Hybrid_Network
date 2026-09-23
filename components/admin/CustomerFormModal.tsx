"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Mail, AlertTriangle, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { createCustomerAction, updateCustomerAction, type ActionState } from "@/lib/actions/customers";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerRow, PlanOption } from "@/lib/types/admin";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-accent-green first:mt-0">
      {children}
    </p>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

export function CustomerFormModal({
  customer,
  plans,
  onClose,
}: {
  customer: CustomerRow | null;
  plans: PlanOption[];
  onClose: () => void;
}) {
  const mode: "create" | "edit" = customer ? "edit" : "create";
  const action = mode === "create" ? createCustomerAction : updateCustomerAction;
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(action, undefined);
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "INVITED">(customer?.status ?? "ACTIVE");
  const [planId, setPlanId] = useState(customer?.planId ?? "");

  useEffect(() => {
    if (state?.success && mode === "edit") {
      onClose();
    }
  }, [state, mode, onClose]);

  // If customer was just created, show the dedicated Success & Email Notification modal
  if (state?.customerCreated) {
    const info = state.customerCreated;
    return (
      <Modal
        open
        onClose={onClose}
        size="lg"
        title="Customer Created"
        description="Customer account registered and invitation email processed"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                onClose();
                window.location.href = `/admin/customers/${info.id}`;
              }}
            >
              View Customer Profile
              <ArrowRight className="size-4" />
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Main Success Banner */}
          <div className="flex items-center gap-3.5 rounded-xl border border-accent-green/30 bg-accent-green/10 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-green/20 text-accent-green">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">Customer Account Created Successfully</p>
              <p className="text-xs text-text-muted">
                Profile and accounts have been registered in the database.
              </p>
            </div>
          </div>

          {/* Customer Summary Box */}
          <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between border-b border-line-soft pb-2">
              <span className="text-xs text-text-muted">Customer Name</span>
              <span className="font-medium text-text-primary">{info.name}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line-soft pb-2">
              <span className="text-xs text-text-muted">Customer ID</span>
              <span className="font-mono text-xs font-semibold text-accent-blue">{info.customerId}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line-soft pb-2">
              <span className="text-xs text-text-muted">Login Email</span>
              <span className="text-xs font-medium text-text-primary">{info.email}</span>
            </div>
            {info.accountNumbers && info.accountNumbers.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Customer Account(s)</span>
                <span className="font-mono text-xs text-accent-green font-medium">{info.accountNumbers.join(", ")}</span>
              </div>
            )}
          </div>

          {/* Email Notification Status Card */}
          {info.emailDelivered ? (
            <div className="flex items-start gap-3 rounded-xl border border-accent-blue/30 bg-accent-blue/10 p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/20 text-accent-blue mt-0.5">
                <Mail className="size-4" />
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-accent-blue">Invitation Email Sent Successfully</p>
                <p className="text-text-secondary leading-relaxed">
                  An invitation email with a temporary password and direct customer portal link has been sent to{" "}
                  <strong className="text-text-primary">{info.email}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/10 p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber/20 text-amber mt-0.5">
                <AlertTriangle className="size-4" />
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-amber">Email Notification Status</p>
                <p className="text-text-secondary leading-relaxed">
                  {info.error ||
                    "Customer created. SMTP isn't configured, so the invitation email was not delivered — configure SMTP and re-send the invitation from the customer profile."}
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={mode === "create" ? "Add New Customer" : `Edit ${customer?.name}`}
      description={
        mode === "create"
          ? "Creates the customer profile and its accounts, and emails the primary login an invitation with a temporary password."
          : undefined
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={isPending}>
            {mode === "create" ? "Add Customer" : "Save Changes"}
          </Button>
        </>
      }
    >
      <form action={formAction} id="customer-form">
        {customer && <input type="hidden" name="id" value={customer.id} />}

        {mode === "edit" && (
          <>
            <SectionLabel>Customer Status</SectionLabel>
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-muted">
                Suspending the customer signs out all of its portal users. Accounts, plans and devices are managed in the
                customer&apos;s Accounts tab.
              </p>
              <input type="hidden" name="status" value={status} />
              <SegmentedControl
                value={status}
                onChange={setStatus}
                options={[
                  { label: "Active", value: "ACTIVE", tone: "green" },
                  { label: "Suspended", value: "SUSPENDED", tone: "amber" },
                  { label: "Invited", value: "INVITED", tone: "red" },
                ]}
              />
            </div>
          </>
        )}

        <SectionLabel>Customer Profile &amp; Primary Login</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" required>
            <Input name="name" defaultValue={customer?.name} required minLength={2} />
          </Field>
          <Field label="Email Address" required>
            <Input name="email" type="email" defaultValue={customer?.email} required />
          </Field>
          <Field label="Phone Number" required>
            <Input name="phone" defaultValue={customer?.phone} required />
          </Field>
          <Field label="Account Type" required>
            <Select name="accountType" defaultValue={customer?.accountType ?? ""} required>
              <option value="">-- Select Account Type --</option>
              <option value="BUSINESS_ENTERPRISE">Business / Enterprise</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="GOVERNMENT">Government</option>
            </Select>
          </Field>
          <Field label="Contact Person">
            <Input name="contactPerson" defaultValue={customer?.contactPerson} />
          </Field>
          <Field label="NID / Trade License" required>
            <Input name="nidTradeLicense" defaultValue={customer?.nidTradeLicense} required />
          </Field>
          <Field label="Card Name">
            <Input name="cardName" defaultValue={customer?.cardName} placeholder="e.g. NI-APAC_SUPPORT" />
          </Field>
          <Field label="ICCID">
            <Input name="iccid" defaultValue={customer?.iccid} placeholder="e.g. KITP00279271" />
          </Field>
          <Field label="IMEI">
            <Input name="imei" defaultValue={customer?.imei} />
          </Field>
          <Field label="Service">
            <Input name="service" defaultValue={customer?.service} placeholder="e.g. Background IP" />
          </Field>
          <Field label="Vendor">
            <Input name="vendor" defaultValue={customer?.vendor} placeholder="e.g. Starlink" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Company">
              <Input name="company" defaultValue={customer?.company} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Full Address">
              <Textarea name="address" defaultValue={customer?.address} rows={2} />
            </Field>
          </div>
        </div>

        <SectionLabel>Customer Accounts</SectionLabel>
        <p className="-mt-2 mb-3 text-xs text-text-muted">
          The Customer Account number is the Customer Code that appears on CDR files. Enter one or more (comma
          separated). More accounts can be added later from the customer&apos;s Accounts tab.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Customer Account Number(s)" required>
              <Input
                name="accountNumbers"
                defaultValue={
                  customer?.accountNumbers && customer.accountNumbers.length > 0
                    ? customer.accountNumbers.join(", ")
                    : (customer?.customerCode ?? "")
                }
                placeholder="e.g. ZZSP100, 10001, 10002"
                required
              />
            </Field>
          </div>
          <Field label="Starlink Vessel ID (first account)" required>
            <Input
              name="starlinkVesselId"
              defaultValue={customer?.starlinkVesselId ?? ""}
              placeholder="e.g. 019ff593-6557-785c-ac33-36d11b7f301c"
              required
            />
          </Field>
          <Field label="Service Plan (first account)" required>
            <Select name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="">-- Select Plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.monthlyPrice, p.currency)}/mo)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Static IP (first account)">
            <Input
              name="staticIp"
              defaultValue={customer?.staticIp ?? ""}
              placeholder="Optional"
            />
          </Field>
        </div>

        <SectionLabel>Network Information</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Origin Number">
            <Input name="originNumber" defaultValue={customer?.network.originNumber} />
          </Field>
          <Field label="Origin Country">
            <Input name="originCountry" defaultValue={customer?.network.originCountry} />
          </Field>
          <Field label="Origin IPAddress">
            <Input name="originIpAddress" defaultValue={customer?.network.originIpAddress} />
          </Field>
          <Field label="Origin Region">
            <Input name="originRegion" defaultValue={customer?.network.originRegion} />
          </Field>
          <Field label="Origin State">
            <Input name="originState" defaultValue={customer?.network.originState} />
          </Field>
          <Field label="Destination Number">
            <Input name="destinationNumber" defaultValue={customer?.network.destinationNumber} />
          </Field>
          <Field label="Destination Network">
            <Input name="destinationNetwork" defaultValue={customer?.network.destinationNetwork} />
          </Field>
          <Field label="Destination Country">
            <Input name="destinationCountry" defaultValue={customer?.network.destinationCountry} />
          </Field>
          <Field label="Destination State">
            <Input name="destinationState" defaultValue={customer?.network.destinationState} />
          </Field>
        </div>

        {state?.error && (
          <div className="mt-5 rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
            {state.error}
          </div>
        )}
      </form>
    </Modal>
  );
}
