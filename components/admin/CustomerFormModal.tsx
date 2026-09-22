"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
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
  const [planId, setPlanId] = useState("");

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

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
          <Field label="Phone Number">
            <Input name="phone" defaultValue={customer?.phone} />
          </Field>
          <Field label="Account Type">
            <Select name="accountType" defaultValue={customer?.accountType ?? ""}>
              <option value="">--</option>
              <option value="BUSINESS_ENTERPRISE">Business / Enterprise</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="GOVERNMENT">Government</option>
            </Select>
          </Field>
          <Field label="Contact Person">
            <Input name="contactPerson" defaultValue={customer?.contactPerson} />
          </Field>
          <Field label="NID / Trade License">
            <Input name="nidTradeLicense" defaultValue={customer?.nidTradeLicense} />
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

        {mode === "create" && (
          <>
            <SectionLabel>Customer Accounts</SectionLabel>
            <p className="-mt-2 mb-3 text-xs text-text-muted">
              The Customer Account number is the Customer Code that appears on CDR files. Enter one or more (comma
              separated). More accounts can be added later from the customer&apos;s Accounts tab.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Customer Account Number(s)">
                  <Input name="accountNumbers" placeholder="e.g. ZZSP100, 10001, 10002" />
                </Field>
              </div>
              <Field label="Starlink Vessel ID (first account)">
                <Input name="starlinkVesselId" placeholder="e.g. 019ff593-6557-785c-ac33-36d11b7f301c" />
              </Field>
              <Field label="Service Plan (first account)">
                <Select name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">-- No plan --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.monthlyPrice, p.currency)}/mo)
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Static IP (first account)">
                <Input name="staticIp" placeholder="Optional" />
              </Field>
            </div>
          </>
        )}

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
