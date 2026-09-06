"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Mail, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { forgotPasswordAction, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type ForgotPasswordFormProps = {
  portalMode?: "admin" | "customer";
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} size="lg">
      Send Reset Link
    </Button>
  );
}

export function ForgotPasswordForm({ portalMode }: ForgotPasswordFormProps) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(forgotPasswordAction, undefined);

  const isAdmin = portalMode === "admin";
  const isCustomer = portalMode === "customer";

  return (
    <div>
      {isAdmin && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
          <ShieldCheck className="size-3.5" />
          <span>Admin Password Recovery</span>
        </div>
      )}

      {isCustomer && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 text-xs font-semibold text-accent-green">
          <UserCheck className="size-3.5" />
          <span>Customer Password Recovery</span>
        </div>
      )}

      <p className="text-2xl font-bold text-text-primary">
        {isAdmin
          ? "Reset Admin Password"
          : isCustomer
          ? "Reset Customer Password"
          : "Forgot password"}
      </p>
      <p className="mt-1.5 text-sm text-text-muted">
        {isAdmin
          ? "Enter your staff email or Admin ID and we'll send you a recovery link."
          : isCustomer
          ? "Enter your customer email or Account ID to receive a password reset link."
          : "Enter your email or ID and we'll send you a link to reset your password."}
      </p>

      {state?.success ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-accent-green/30 bg-accent-green/10 px-3.5 py-3 text-xs text-accent-green">
          <CheckCircle2 className="size-4 shrink-0 translate-y-0.5" />
          {state.success}
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="identifier" className="mb-1.5 block text-xs font-medium text-text-secondary">
              {isAdmin
                ? "Staff Email or Admin ID"
                : isCustomer
                ? "Customer Email or Account ID"
                : "Email or Customer / Admin ID"}
            </label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder={
                isAdmin
                  ? "admin@hybridnetworks.com"
                  : isCustomer
                  ? "you@company.com or HN-CUST-00001"
                  : "you@company.com or HN-CUST-00001"
              }
              icon={<Mail className="size-4" />}
              required
            />
          </div>

          {state?.error && (
            <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
              {state.error}
            </div>
          )}

          <SubmitButton />
        </form>
      )}

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to sign in
      </Link>
    </div>
  );
}
