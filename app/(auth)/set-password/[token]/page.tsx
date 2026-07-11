import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { hashToken } from "@/lib/auth/tokens";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export const metadata: Metadata = {
  title: "Set Your Password | Hybrid Networks",
};

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  await connectDB();
  const user = await User.findOne({
    inviteTokenHash: hashToken(token),
    inviteTokenExpiry: { $gt: new Date() },
    status: "INVITED",
  }).lean();

  if (!user) {
    return (
      <div>
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-red/15 text-red">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="text-xl font-bold text-text-primary">Invitation link expired</h1>
        <p className="mt-2 text-sm text-text-muted">
          This invitation link is invalid or has expired. Please contact your administrator to
          request a new invite, or reach out to support if you believe this is a mistake.
        </p>
        <a
          href="mailto:support@hybridnetworks.com"
          className="mt-6 inline-block text-sm font-medium text-accent-green hover:underline"
        >
          Contact support &rarr;
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Set your password</h1>
      <p className="mt-1.5 text-sm text-text-muted">
        Welcome, {user.name.split(" ")[0]}. Choose a password to activate your account.
      </p>

      <div className="mt-5 space-y-3 rounded-xl border border-line bg-surface-raised p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Name</span>
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

      <SetPasswordForm token={token} />
    </div>
  );
}
