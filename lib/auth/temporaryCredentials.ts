import "server-only";
import crypto from "node:crypto";
import type { HydratedDocument } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, type UserDoc } from "@/models/User";
import { CustomerAccount } from "@/models/CustomerAccount";
import { ActivityLog } from "@/models/ActivityLog";
import { hashPassword } from "@/lib/auth/password";
import { sendMail } from "@/lib/email/mailer";
import { temporaryCredentialsEmailHtml } from "@/emails/templates";
import { formatDateTime } from "@/lib/utils/format";

// Customer invitation workflow:
//   admin creates the portal user -> sendCustomerInvitation() generates a
//   temporary password (only its bcrypt hash is stored) and emails it ->
//   the customer signs in -> is forced through /first-login-change-password
//   -> the account becomes ACTIVE.
// The plaintext password exists only in memory and in the email; it is never
// logged, stored or returned to the admin UI.

export const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generates a strong, human-readable temporary password (e.g. "HN-9KX2#mp8a").
 */
export function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const lower = "abcdefghijkmnpqrstuvwxyz23456789";
  const specials = ["#", "!", "@", "$"];

  let part1 = "";
  const buf1 = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    part1 += chars[buf1[i] % chars.length];
  }

  let part2 = "";
  const buf2 = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    part2 += lower[buf2[i] % lower.length];
  }

  const special = specials[crypto.randomBytes(1)[0] % specials.length];

  return `HN-${part1}${special}${part2}`;
}

async function invitedAccountNumbers(user: HydratedDocument<UserDoc>): Promise<string[]> {
  const profileId = user.customerProfile ?? user._id;
  const filter: Record<string, unknown> = { customer: profileId, status: { $ne: "CLOSED" } };
  if (user.accountAccessAll === false) filter._id = { $in: user.accountAccess ?? [] };
  const accounts = await CustomerAccount.find(filter).select("accountNumber").sort({ accountNumber: 1 }).lean();
  return accounts.map((a) => a.accountNumber);
}

/**
 * Issues a fresh temporary password to a customer portal user and emails the
 * invitation. Used for new users and for re-invites (which invalidate any
 * previous temporary password). Never used for users who already set their
 * own password — they use "Forgot password" instead.
 */
export async function sendCustomerInvitation(
  user: HydratedDocument<UserDoc>,
  options: { actorId: string; reason: "USER_CREATED" | "RE_INVITE" }
): Promise<{ success: boolean; error?: string; delivered?: boolean }> {
  if (user.role !== "CUSTOMER") return { success: false, error: "Only customer portal users are invited this way." };
  if (user.status === "SUSPENDED") return { success: false, error: "Reactivate this user before re-inviting them." };

  try {
    await connectDB();
    const tempPassword = generateTemporaryPassword();
    const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);

    user.passwordHash = await hashPassword(tempPassword);
    user.status = "INVITED";
    user.mustChangePassword = true;
    user.tempPasswordIssuedAt = new Date();
    user.tempPasswordExpiresAt = expiresAt;
    user.inviteTokenHash = null;
    user.inviteTokenExpiry = null;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    const profile = user.customerProfile ? await User.findById(user.customerProfile).select("company name customerId").lean() : null;
    const portalUrl = `${process.env.CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;

    const mail = await sendMail({
      to: user.email,
      subject: "Your Hybrid Networks Customer Portal invitation",
      html: temporaryCredentialsEmailHtml({
        name: user.name,
        companyName: profile ? profile.company || profile.name : user.company || null,
        customerId: profile?.customerId ?? user.customerId,
        email: user.email,
        temporaryPassword: tempPassword,
        portalUrl,
        expiresAt: formatDateTime(expiresAt),
        accountNumbers: await invitedAccountNumbers(user),
      }),
    });

    await ActivityLog.create({
      actor: options.actorId,
      targetCustomer: user.customerProfile ?? user._id,
      action: options.reason === "RE_INVITE" ? "INVITE_RESENT" : "INVITE_SENT",
      meta: { email: user.email, userId: user._id.toString(), expiresAt, delivered: mail.delivered },
    });

    return { success: true, delivered: mail.delivered };
  } catch (err) {
    console.error("[invitation] failed to invite", user.email, err);
    return { success: false, error: "The invitation email could not be sent. Check SMTP settings and try again." };
  }
}
