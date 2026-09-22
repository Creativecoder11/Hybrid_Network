import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { User, type UserRole } from "@/models/User";
import { getSession } from "@/lib/auth/session";

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;
  return session;
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  if (!session) return null;

  await connectDB();
  const user = await User.findById(session.userId).lean();
  if (!user || user.status === "SUSPENDED") return null;

  // An additional portal user loses access when the Customer Profile it
  // belongs to is suspended or deleted.
  const customerProfileId = user.customerProfile ? user.customerProfile.toString() : null;
  if (customerProfileId) {
    const profile = await User.findById(customerProfileId).select("status").lean();
    if (!profile || profile.status === "SUSPENDED") return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    customerId: user.customerId ?? null,
    avatarUrl: user.avatarUrl ?? "",
    mustChangePassword: Boolean(user.mustChangePassword),
    // Customer Profile that owns this login's data: itself for a profile's
    // primary login, the parent profile for additional portal users.
    customerProfileId: user.role === "CUSTOMER" ? (customerProfileId ?? user._id.toString()) : null,
    accountAccessAll: user.accountAccessAll !== false,
    accountAccess: (user.accountAccess ?? []).map((id) => id.toString()),
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Redirects to /login if not authenticated. Use in Server Components / Pages.
 *
 * A signed session cookie can outlive the account behind it (user suspended
 * or deleted). The proxy only checks the cookie's signature, so redirecting
 * straight to /login would bounce back to the portal forever — the signout
 * route clears the cookie first.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const session = await verifySession();
    redirect(session ? "/api/auth/signout?reason=inactive" : "/login");
  }
  return user;
}

/** Redirects to /login if unauthenticated, or to the caller-provided fallback if wrong role. */
export async function requireRole(
  roles: UserRole[],
  fallback = "/login"
): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.mustChangePassword) {
    redirect("/first-login-change-password");
  }
  if (!roles.includes(user.role)) {
    redirect(fallback);
  }
  return user;
}

/**
 * For Route Handlers / Server Actions: never redirects, returns null instead.
 * A user who still has to replace a temporary password is only allowed
 * through when the caller opts in (the password-change action itself).
 */
export async function getAuthorizedUser(
  roles?: UserRole[],
  options?: { allowPendingPasswordChange?: boolean }
): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.mustChangePassword && !options?.allowPendingPasswordChange) return null;
  if (roles && !roles.includes(user.role)) return null;
  return user;
}
