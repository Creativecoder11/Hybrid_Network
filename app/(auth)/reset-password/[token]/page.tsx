import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { hashToken } from "@/lib/auth/tokens";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password | Hybrid Networks",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  await connectDB();
  const user = await User.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpiry: { $gt: new Date() },
  }).lean();

  if (!user) {
    return (
      <div>
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-red/15 text-red">
          <AlertTriangle className="size-5" />
        </div>
        <p className="text-xl font-bold text-text-primary">Reset link expired</p>
        <p className="mt-2 text-sm text-text-muted">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <a
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-accent-green hover:underline"
        >
          Request a new link &rarr;
        </a>
      </div>
    );
  }

  return (
    <div>
      <p className="text-2xl font-bold text-text-primary">Reset your password</p>
      <p className="mt-1.5 text-sm text-text-muted">Hi {user.name.split(" ")[0]}, choose a new password below.</p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
