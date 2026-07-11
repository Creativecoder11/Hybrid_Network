"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { updateSettingsAction, testSmtpAction } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/customers";

type SettingsData = {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
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

export function SettingsPageClient({
  settings,
  adminEmail,
}: {
  settings: SettingsData;
  adminEmail: string;
}) {
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
        <p className="text-sm">Company profile, billing defaults, and email delivery.</p>
      </div>

      <form action={formAction}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Company &amp; Billing</CardTitle>
              <CardDescription>Shown on invoices and customer-facing emails.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Company Name">
                <Input name="companyName" defaultValue={settings.companyName} required />
              </Field>
            </div>
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
                Send a test email to confirm delivery.
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
