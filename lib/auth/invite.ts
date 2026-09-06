import "server-only";
import type { HydratedDocument } from "mongoose";
import { generateRawToken, hashToken, INVITE_TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/email/mailer";
import { inviteEmailHtml } from "@/emails/templates";
import type { UserDoc } from "@/models/User";

/**
 * Generates a fresh invite token for a user, stores its hash, flips status
 * to INVITED, and emails the set-password link. Used both when a new
 * customer/team member is created and when an admin resends an invite.
 */
export async function issueInvite(
  user: HydratedDocument<UserDoc>,
  options?: { isTeamInvite?: boolean }
) {
  const rawToken = generateRawToken();
  user.inviteTokenHash = hashToken(rawToken);
  user.inviteTokenExpiry = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
  user.status = "INVITED";
  await user.save();

  const baseUrl = options?.isTeamInvite
    ? (process.env.ADMIN_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    : (process.env.CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  const actionUrl = `${baseUrl}/set-password/${rawToken}`;

  await sendMail({
    to: user.email,
    subject: "Your Hybrid Networks account is ready",
    html: inviteEmailHtml({
      name: user.name,
      customerId: user.customerId,
      actionUrl,
      isTeamInvite: options?.isTeamInvite,
    }),
  });
}
