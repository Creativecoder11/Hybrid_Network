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
  const [planId, setPlanId] = useState(customer?.planId ?? "");

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  const selectedPlan = plans.find((p) => p.id === planId);

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={mode === "create" ? "Add New Customer" : `Edit ${customer?.name}`}
      description={mode === "create" ? "Creates the account and sends an activation email." : undefined}
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
            <SectionLabel>Current Plan</SectionLabel>
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {selectedPlan?.name || "No active plan"}
                </p>
                {selectedPlan && (
                  <p className="mt-0.5 text-xs text-text-muted">
                    {selectedPlan.sharedRatio ? `${selectedPlan.sharedRatio} shared` : ""}
                    {selectedPlan.speedMbps ? ` · up to ${selectedPlan.speedMbps} Mbps` : ""}
                    {" · "}
                    {formatCurrency(selectedPlan.monthlyPrice, selectedPlan.currency)}/month
                  </p>
                )}
              </div>
              <input type="hidden" name="status" value={status} />
              <SegmentedControl
                value={status}
                onChange={setStatus}
                options={[
                  { label: "Active", value: "ACTIVE", tone: "green" },
                  { label: "Suspended", value: "SUSPENDED", tone: "amber" },
                  { label: "Inactive", value: "INVITED", tone: "red" },
                ]}
              />
            </div>
          </>
        )}

        <SectionLabel>User Information</SectionLabel>
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
          <Field label="Customer Code">
            <Input name="customerCode" defaultValue={customer?.customerCode} placeholder="e.g. ZZSP100" />
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

        <SectionLabel>Starlink Linking</SectionLabel>
        <p className="-mt-2 mb-3 text-xs text-text-muted">
          Links this customer to a real device in the Starlink/SLASH API. Starlink has no ICCID —
          paste the Vessel ID from the SLASH dashboard to pull live status, usage, and location for
          this customer&apos;s terminal(s). Leave blank to keep using simulated device data.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Starlink Vessel ID">
            <Input
              name="starlinkVesselId"
              defaultValue={customer?.starlinkVesselId}
              placeholder="e.g. 019ff593-6557-785c-ac33-36d11b7f301c"
            />
          </Field>
          <Field label="Starlink Service Line Number">
            <Input
              name="starlinkServiceLineNumber"
              defaultValue={customer?.starlinkServiceLineNumber}
              placeholder="e.g. SL-DF-15109193-35286-9"
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

        {mode === "edit" && (
          <>
            <SectionLabel>Usage This Period</SectionLabel>
            <p className="-mt-2 mb-3 text-xs text-text-muted">
              Manual override for the current billing period. Values are in GB unless noted.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Volume Data (GB)">
                <Input
                  name="volumeDataBytesGb"
                  type="number"
                  step="0.01"
                  defaultValue={customer?.usage?.volumeDataGB}
                />
              </Field>
              <Field label="Volume Min">
                <Input name="volumeMin" type="number" step="1" defaultValue={customer?.usage?.volumeMin} />
              </Field>
              <Field label="Volume Msg">
                <Input name="volumeMsg" type="number" step="1" defaultValue={customer?.usage?.volumeMsg} />
              </Field>
              <Field label="Volume In Bundle (GB)">
                <Input
                  name="volumeInBundleBytesGb"
                  type="number"
                  step="0.01"
                  defaultValue={customer?.usage?.volumeInBundleGB}
                />
              </Field>
              <Field label="Volume Out Bundle (GB)">
                <Input
                  name="volumeOutBundleBytesGb"
                  type="number"
                  step="0.01"
                  defaultValue={customer?.usage?.volumeOutBundleGB}
                />
              </Field>
              <Field label="Volume Total (GB)">
                <Input
                  name="volumeTotalBytesGb"
                  type="number"
                  step="0.01"
                  defaultValue={customer?.usage?.volumeTotalGB}
                />
              </Field>
            </div>

            <SectionLabel>Bundle Consumption</SectionLabel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Consumption — Money">
                <Input
                  name="consumptionMoney"
                  type="number"
                  step="0.01"
                  defaultValue={customer?.usage?.consumptionMoney}
                />
              </Field>
              <Field label="Consumption — Data (GB)">
                <Input
                  name="consumptionDataBytesGb"
                  type="number"
                  step="0.01"
                  defaultValue={customer?.usage?.consumptionDataGB}
                />
              </Field>
              <Field label="Consumption — Minutes">
                <Input
                  name="consumptionMin"
                  type="number"
                  step="1"
                  defaultValue={customer?.usage?.consumptionMin}
                />
              </Field>
              <Field label="Consumption — Messages">
                <Input
                  name="consumptionMsg"
                  type="number"
                  step="1"
                  defaultValue={customer?.usage?.consumptionMsg}
                />
              </Field>
            </div>
          </>
        )}

        <SectionLabel>{mode === "create" ? "Assign Plan" : "Change Plan"}</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Service Plan">
            <Select name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">-- No plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.monthlyPrice, p.currency)}/mo)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Static IP">
            <Input name="staticIp" defaultValue={customer?.staticIp} placeholder="Optional" />
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
