"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { loginAction, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";

type LoginFormProps = {
  portalMode?: "admin" | "customer";
  adminPortalUrl?: string;
  customerPortalUrl?: string;
};

function SubmitButton({ label = "Sign In" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} size="lg">
      {label}
    </Button>
  );
}

export function LoginForm({
  portalMode,
  adminPortalUrl,
  customerPortalUrl,
}: LoginFormProps) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  const isAdmin = portalMode === "admin";
  const isCustomer = portalMode === "customer";

  return (
    <div>
      {/* Portal Identification Badge */}
      {isAdmin && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
          <ShieldCheck className="size-3.5" />
          <span>Admin &amp; Operations Portal</span>
        </div>
      )}

      {isCustomer && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 text-xs font-semibold text-accent-green">
          <UserCheck className="size-3.5" />
          <span>Customer &amp; Client Portal</span>
        </div>
      )}

      {/* Screen Title & Subtitle */}
      <p className="text-2xl font-bold text-text-primary">
        {isAdmin
          ? "Administrator Sign In"
          : isCustomer
          ? "Customer Sign In"
          : "Welcome back"}
      </p>
      <p className="mt-1.5 text-sm text-text-muted">
        {isAdmin
          ? "Enter your staff email or Admin ID to access the control center."
          : isCustomer
          ? "Sign in with your Customer ID or Email to manage services & billing."
          : "Sign in with your email or ID to continue."}
      </p>

      {resetSuccess && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-accent-green/30 bg-accent-green/10 px-3.5 py-2.5 text-xs text-accent-green">
          <CheckCircle2 className="size-4 shrink-0" />
          Your password has been reset. Sign in with your new password.
        </div>
      )}

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

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<Lock className="size-4" />}
            required
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="pointer-events-auto text-text-muted hover:text-text-primary"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <Checkbox name="keepSignedIn" />
            Keep me signed in
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-accent-green hover:underline">
            Forgot password?
          </Link>
        </div>

        {state?.error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
            {state.error}
          </div>
        )}

        <SubmitButton label={isAdmin ? "Sign In to Admin" : isCustomer ? "Sign In to Portal" : "Sign In"} />
      </form>

      {/* Cross-Domain Redirection Hint */}
      {isAdmin && customerPortalUrl && (
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center text-xs text-text-muted">
          <span>Are you a customer? </span>
          <a
            href={customerPortalUrl}
            className="inline-flex items-center gap-1 font-semibold text-accent-green hover:underline"
          >
            Go to Customer Portal <ArrowRight className="size-3" />
          </a>
        </div>
      )}

      {isCustomer && adminPortalUrl && (
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center text-xs text-text-muted">
          <span>Are you an administrator or staff? </span>
          <a
            href={adminPortalUrl}
            className="inline-flex items-center gap-1 font-semibold text-blue-400 hover:underline"
          >
            Go to Admin Portal <ArrowRight className="size-3" />
          </a>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-text-muted">
        Trouble signing in?{" "}
        <a href="mailto:support@hybridnetworks.com" className="font-medium text-accent-blue hover:underline">
          Contact IT Support
        </a>
      </p>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-transparent p-4 text-xs text-text-muted">
          <p className="font-medium text-amber-600">Dev-only seed credentials — hidden in production</p>

          {(!isCustomer || !portalMode) && (
            <div className="mt-3">
              <p className="text-sm font-medium text-text-primary">Admin Portal Accounts</p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="pb-1 pr-4 font-medium">Role</th>
                      <th className="pb-1 pr-4 font-medium">Email</th>
                      <th className="pb-1 font-medium">Password</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-primary">
                    <tr className="border-t border-slate-200">
                      <td className="py-1.5 pr-4">Super Admin</td>
                      <td className="py-1.5 pr-4">admin@hybridnetworks.com</td>
                      <td className="py-1.5">HybridAdmin@123</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="py-1.5 pr-4">Sub Admin</td>
                      <td className="py-1.5 pr-4">ayesha@hybridnetworks.com</td>
                      <td className="py-1.5">HybridSub@123</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!isAdmin || !portalMode) && (
            <div className="mt-4">
              <p className="text-sm font-medium text-text-primary">Customer Portal Accounts</p>
              <p className="mt-0.5 text-text-secondary">
                Password: <span className="font-medium text-text-primary">Customer@123</span>
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="pb-1 pr-4 font-medium">Customer</th>
                      <th className="pb-1 pr-4 font-medium">Email</th>
                      <th className="pb-1 pr-4 font-medium">Customer Code</th>
                      <th className="pb-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-primary">
                    <tr className="border-t border-slate-200">
                      <td className="py-1.5 pr-4">NI-APAC Client</td>
                      <td className="py-1.5 pr-4">ops@ni-apac-support.example</td>
                      <td className="py-1.5 pr-4">ZZSP100</td>
                      <td className="py-1.5">Active</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
