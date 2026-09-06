"use server";

import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession, deleteSession, getSession } from "@/lib/auth/session";
import { generateRawToken, hashToken, RESET_TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/email/mailer";
import { passwordResetEmailHtml } from "@/emails/templates";
import {
  loginSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export type AuthFormState = {
  error?: string;
  success?: string;
} | undefined;

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function homeForRole(role: string) {
  return role === "CUSTOMER" ? "/portal" : "/admin";
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    identifier: String(formData.get("identifier") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    keepSignedIn: formData.get("keepSignedIn") === "on",
  });

  if (!parsed.success) {
    return { error: "Enter your email/ID and password." };
  }

  await connectDB();

  const identifier = parsed.data.identifier;
  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { customerId: identifier.toUpperCase() }],
  }).select("+passwordHash");

  if (!user) {
    return { error: "Invalid email/ID or password." };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` };
  }

  if (user.status === "INVITED") {
    return {
      error:
        "Your account hasn't been activated yet. Check your email for the setup link, or ask your administrator to resend it.",
    };
  }

  if (user.status === "SUSPENDED") {
    return { error: "Your account has been suspended. Contact support for assistance." };
  }

  const validPassword = user.passwordHash
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : false;

  if (!validPassword) {
    const attempts = (user.loginAttempts ?? 0) + 1;
    const update: Record<string, unknown> = { loginAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      update.loginAttempts = 0;
    }
    await User.updateOne({ _id: user._id }, update);
    await ActivityLog.create({ actor: user._id, action: "LOGIN_FAILED" });
    return { error: "Invalid email/ID or password." };
  }

  await User.updateOne({ _id: user._id }, { loginAttempts: 0, lockedUntil: null });
  await createSession(user._id.toString(), user.role, parsed.data.keepSignedIn);
  await ActivityLog.create({ actor: user._id, action: "LOGIN" });

  redirect(homeForRole(user.role));
}

export async function logoutAction() {
  const session = await getSession();
  await connectDB();
  if (session) {
    await ActivityLog.create({ actor: session.userId, action: "LOGOUT" });
  }
  await deleteSession();
  redirect("/login");
}

export async function setPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = setPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const tokenHash = hashToken(parsed.data.token);
  const user = await User.findOne({
    inviteTokenHash: tokenHash,
    inviteTokenExpiry: { $gt: new Date() },
    status: "INVITED",
  });

  if (!user) {
    return {
      error:
        "This invitation link is invalid or has expired. Please contact your administrator for a new invite.",
    };
  }

  user.passwordHash = await hashPassword(parsed.data.password);
  user.status = "ACTIVE";
  user.inviteTokenHash = null;
  user.inviteTokenExpiry = null;
  await user.save();

  await ActivityLog.create({
    actor: user._id,
    targetCustomer: user.role === "CUSTOMER" ? user._id : null,
    action: "PASSWORD_SET",
  });

  await createSession(user._id.toString(), user.role, false);

  redirect(homeForRole(user.role));
}

export async function forgotPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    identifier: String(formData.get("identifier") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: "Enter your email or ID." };
  }

  await connectDB();
  const identifier = parsed.data.identifier;
  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { customerId: identifier.toUpperCase() }],
    status: "ACTIVE",
  });

  if (user) {
    const rawToken = generateRawToken();
    user.resetTokenHash = hashToken(rawToken);
    user.resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const baseUrl = user.role === "CUSTOMER"
      ? (process.env.CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      : (process.env.ADMIN_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    const actionUrl = `${baseUrl}/reset-password/${rawToken}`;
    await sendMail({
      to: user.email,
      subject: "Reset your Hybrid Networks password",
      html: passwordResetEmailHtml({ name: user.name, actionUrl }),
    });

    await ActivityLog.create({ actor: user._id, action: "PASSWORD_RESET_REQUESTED" });
  }

  // Always return the same message, whether or not an account was found,
  // so this endpoint can't be used to enumerate registered emails/IDs.
  return {
    success:
      "If an account matches that email or ID, we've sent a password reset link. It expires in 1 hour.",
  };
}

export async function resetPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const tokenHash = hashToken(parsed.data.token);
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiry: { $gt: new Date() },
  });

  if (!user) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  user.passwordHash = await hashPassword(parsed.data.password);
  user.resetTokenHash = null;
  user.resetTokenExpiry = null;
  user.loginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  await ActivityLog.create({ actor: user._id, action: "PASSWORD_RESET" });

  redirect("/login?reset=success");
}
