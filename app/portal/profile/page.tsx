import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireRole } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/Card";
import { ChangePasswordForm } from "@/components/portal/ChangePasswordForm";
import { displayOrDash, formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Profile | Hybrid Networks Portal",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-2.5 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-primary">{displayOrDash(value)}</span>
    </div>
  );
}

export default async function PortalProfilePage() {
  const user = await requireRole(["CUSTOMER"], "/admin");

  await connectDB();
  const customer = await User.findById(user.id).lean();
  if (!customer) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xl font-bold text-text-primary">Profile</p>
        <p className="text-sm text-text-muted">Your account information and security settings.</p>
      </div>

      {customer.mustChangePassword && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber/20 text-xs font-bold text-amber">
              !
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Action Required: Update Your Password</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                You are currently logged in with a temporary password. Please set a new permanent password below to secure your account.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-green">Account Information</p>
          <InfoRow label="Full Name" value={customer.name} />
          <InfoRow label="Customer ID" value={customer.customerId} />
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Phone" value={customer.phone} />
          <InfoRow label="Company" value={customer.company} />
          <InfoRow label="Address" value={customer.address} />
          <InfoRow label="Member Since" value={formatDate(customer.createdAt as Date)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-accent-green">Change Password</p>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
