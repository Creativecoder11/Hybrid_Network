"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, MapPin, Route, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { updateSettingsAction, testSmtpAction, setPortalFeatureAction } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/customers";

type SettingsData = {
  companyName: string;
  companyLegalName: string;
  companyAbn: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  paymentInstructions: string;
  currency: string;
  taxLabel: string;
  taxRate: number;
  invoicePrefix: string;
  timezone: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FeatureToggle({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof MapPin;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          <p className="mt-0.5 text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${checked ? "text-accent-green" : "text-text-muted"}`}>{checked ? "ON" : "OFF"}</span>
        <Switch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

export function SettingsPageClient({
  settings,
  adminEmail,
  features,
  missingInvoiceDetails,
  slashWriteNotifyEmail,
}: {
  settings: SettingsData;
  adminEmail: string;
  features: { deviceLocation: boolean; tracking: boolean };
  missingInvoiceDetails: string[];
  slashWriteNotifyEmail: string;
}) {
  const router = useRouter();
  const [featureState, setFeatureState] = useState(features);
  const [featurePending, startFeature] = useTransition();

  function toggleFeature(feature: "deviceLocation" | "tracking", enabled: boolean) {
    const previous = featureState;
    setFeatureState((f) => ({ ...f, [feature]: enabled }));
    startFeature(async () => {
      const res = await setPortalFeatureAction(feature, enabled);
      if (res?.error) {
        toast.error(res.error);
        setFeatureState(previous);
      } else {
        toast.success(res?.success ?? "Saved.");
        router.refresh();
      }
    });
  }

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateSettingsAction,
    undefined
  );
  const [smtpState, smtpAction, smtpPending] = useActionState<ActionState, FormData>(
    testSmtpAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  useEffect(() => {
    if (smtpState?.success) toast.success(smtpState.success);
    if (smtpState?.error) toast.error(smtpState.error);
  }, [smtpState]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-2xl font-bold text-text-primary">Settings</p>
        <p className="text-sm">Company profile, billing defaults, customer portal features, and email delivery.</p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Customer Portal Features</CardTitle>
            <CardDescription>
              Controlled by Super Admins only and enforced on the server for every customer. Customers cannot change
              these.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <FeatureToggle
            icon={MapPin}
            title="Device Location"
            description="When OFF, customers see no device coordinates or maps anywhere in the portal or its exports."
            checked={featureState.deviceLocation}
            disabled={featurePending}
            onChange={(v) => toggleFeature("deviceLocation", v)}
          />
          <FeatureToggle
            icon={Route}
            title="Tracking"
            description={
              featureState.deviceLocation
                ? "When OFF, the Tracking page and location history are unavailable to customers."
                : "Tracking needs Device Location to be ON — it is currently blocked for customers."
            }
            checked={featureState.tracking}
            disabled={featurePending}
            onChange={(v) => toggleFeature("tracking", v)}
          />
        </CardContent>
      </Card>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Company &amp; Billing</CardTitle>
              <CardDescription>Printed on tax invoices and shown in the customer portal&apos;s Pay Now dialog.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {missingInvoiceDetails.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-xs text-amber sm:col-span-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Tax invoices are missing: {missingInvoiceDetails.join(", ")}. Fill these in so invoices carry the
                correct company details.
              </div>
            )}
            <Field label="Trading Name">
              <Input name="companyName" defaultValue={settings.companyName} required />
            </Field>
            <Field label="Legal Entity Name">
              <Input name="companyLegalName" defaultValue={settings.companyLegalName} required placeholder="e.g. Hybrid Networks Pty Ltd" />
            </Field>
            <Field label="ABN">
              <Input name="companyAbn" defaultValue={settings.companyAbn} placeholder="11-digit Australian Business Number" />
            </Field>
            <Field label="Website">
              <Input name="companyWebsite" defaultValue={settings.companyWebsite} placeholder="e.g. www.example.com.au" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Company Address">
                <Textarea name="companyAddress" defaultValue={settings.companyAddress} rows={2} />
              </Field>
            </div>
            <Field label="Company Email">
              <Input name="companyEmail" type="email" defaultValue={settings.companyEmail} />
            </Field>
            <Field label="Company Phone">
              <Input name="companyPhone" defaultValue={settings.companyPhone} />
            </Field>
            <Field label="Currency">
              <Input name="currency" defaultValue={settings.currency} required />
            </Field>
            <Field label="Timezone">
              <Input name="timezone" defaultValue={settings.timezone} required />
            </Field>
            <Field label="Tax Label">
              <Input name="taxLabel" defaultValue={settings.taxLabel} required placeholder="e.g. GST" />
            </Field>
            <Field label="Tax Rate (%)">
              <Input name="taxRate" type="number" step="0.01" defaultValue={settings.taxRate} required />
            </Field>
            <Field label="Invoice Prefix">
              <Input name="invoicePrefix" defaultValue={settings.invoicePrefix} required placeholder="e.g. HINV" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Payment Instructions">
                <Textarea
                  name="paymentInstructions"
                  defaultValue={settings.paymentInstructions}
                  rows={4}
                  placeholder={"e.g. Bank: …\nBSB: …  Account: …\nPlease use your invoice number as the reference."}
                />
              </Field>
              <p className="mt-1 text-[11px] text-text-muted">Printed on invoices and shown to customers when they click Pay Now.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" loading={isPending}>
              Save Settings
            </Button>
          </CardFooter>
        </Card>
      </form>

      <form action={smtpAction}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Email Delivery</CardTitle>
              <CardDescription>
                SMTP is configured via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
                Send a test email to confirm delivery. Invitations, unallocated-CDR alerts and the SLASH WRITE notices to{" "}
                <span className="font-mono">{slashWriteNotifyEmail}</span> all depend on it.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Field label="Send test email to">
              <Input name="testEmail" type="email" placeholder={adminEmail} defaultValue={adminEmail} />
            </Field>
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="outline" loading={smtpPending}>
              <Send className="size-4" />
              Send Test Email
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
