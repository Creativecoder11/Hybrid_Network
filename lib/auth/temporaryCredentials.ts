import "server-only";
import crypto from "node:crypto";
import type { HydratedDocument, Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, type UserDoc } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { hashPassword } from "@/lib/auth/password";
import { sendMail } from "@/lib/email/mailer";
import { temporaryCredentialsEmailHtml } from "@/emails/templates";

/**
 * Generates a strong, human-readable temporary password (e.g. "HN-9kX2#mP8").
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

/**
 * Checks if a customer needs temporary login credentials.
 * A customer needs credentials if:
 * 1. They have no passwordHash set yet, OR
 * 2. Their status is "INVITED" (never finished activating), OR
 * 3. They are currently flagged with mustChangePassword
 */
export function customerNeedsCredentials(user: UserDoc): boolean {
  if (user.status === "SUSPENDED") return false;
  if (user.status === "INVITED") return true;
  if (!user.passwordHash) return true;
  if (user.mustChangePassword) return true;
  return false;
}

/**
 * Issues a temporary password to a customer and emails the credentials to them.
 */
export async function sendTemporaryCredentialsToCustomer(
  user: HydratedDocument<UserDoc>,
  options?: { actorId?: string; reason?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(tempPassword);

    user.passwordHash = hashedPassword;
    user.status = "ACTIVE";
    user.mustChangePassword = true;
    user.tempPasswordIssuedAt = new Date();
    user.inviteTokenHash = null;
    user.inviteTokenExpiry = null;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    const portalUrl = `${process.env.CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;

    await sendMail({
      to: user.email,
      subject: "Your Hybrid Networks Portal Login Details",
      html: temporaryCredentialsEmailHtml({
        name: user.name,
        customerId: user.customerId,
        email: user.email,
        temporaryPassword: tempPassword,
        portalUrl,
      }),
    });

    await ActivityLog.create({
      actor: options?.actorId ?? user._id,
      targetCustomer: user._id,
      action: "CREDENTIALS_SENT",
      meta: {
        event: "TEMPORARY_CREDENTIALS_DISPATCHED",
        reason: options?.reason ?? "CDR_MATCH_ONBOARDING",
        email: user.email,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("[temporaryCredentials] failed to issue credentials to", user.email, err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to issue credentials" };
  }
}

/**
 * Process a list of matched customer IDs (e.g. from CDR upload).
 * Finds customers who need credentials and sends temporary login details.
 */
export async function processTemporaryCredentialsForCustomers(
  customerIds: (string | Types.ObjectId)[],
  options?: { actorId?: string; reason?: string }
): Promise<{ dispatchedCount: number; errors: string[] }> {
  if (customerIds.length === 0) return { dispatchedCount: 0, errors: [] };

  await connectDB();
  const uniqueIds = Array.from(new Set(customerIds.map((id) => id.toString())));

  const customers = await User.find({
    _id: { $in: uniqueIds },
    role: "CUSTOMER",
    status: { $ne: "SUSPENDED" },
  }).select("+passwordHash");

  let dispatchedCount = 0;
  const errors: string[] = [];

  for (const customer of customers) {
    if (customerNeedsCredentials(customer)) {
      const res = await sendTemporaryCredentialsToCustomer(customer, options);
      if (res.success) {
        dispatchedCount++;
      } else if (res.error) {
        errors.push(`${customer.email}: ${res.error}`);
      }
    }
  }

  return { dispatchedCount, errors };
}

