import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { FirstLoginChangePasswordForm } from "@/components/auth/FirstLoginChangePasswordForm";

export const metadata: Metadata = {
  title: "Set Permanent Password | Hybrid Networks",
};

export default async function FirstLoginChangePasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.mustChangePassword) {
    redirect(user.role === "CUSTOMER" ? "/portal" : "/admin");
  }

  return (
    <div>
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
        <KeyRound className="size-5" />
      </div>

      <p className="text-2xl font-bold text-text-primary">First-Time Login Security</p>
      <p className="mt-1.5 text-sm text-text-muted">
        Welcome, {user.name.split(" ")[0]}. You are currently logged in with a temporary password.
        For account security, you must set a new password before accessing your dashboard.
      </p>

      <div className="mt-5 space-y-2.5 rounded-xl border border-line bg-surface-raised p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">User Profile</span>
          <span className="font-medium text-text-primary">{user.name}</span>
        </div>
        {user.customerId && (
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Customer ID</span>
            <span className="font-semibold text-accent-green">{user.customerId}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Email</span>
          <span className="font-medium text-text-primary">{user.email}</span>
        </div>
      </div>

      <FirstLoginChangePasswordForm />
    </div>
  );
}

