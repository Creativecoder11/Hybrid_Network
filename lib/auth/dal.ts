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

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    customerId: user.customerId ?? null,
    avatarUrl: user.avatarUrl ?? "",
    mustChangePassword: Boolean(user.mustChangePassword),
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Redirects to /login if not authenticated. Use in Server Components / Pages. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects to /login if unauthenticated, or to the caller-provided fallback if wrong role. */
export async function requireRole(
  roles: UserRole[],
  fallback = "/login"
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(fallback);
  }
  return user;
}

/** For Route Handlers / Server Actions: never redirects, returns null instead. */
export async function getAuthorizedUser(roles?: UserRole[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (roles && !roles.includes(user.role)) return null;
  return user;
}
