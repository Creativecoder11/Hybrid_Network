import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isValidObjectId, type Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { CustomerAccount, type CustomerAccountStatus } from "@/models/CustomerAccount";
import { getAuthorizedUser, requireRole, type CurrentUser } from "@/lib/auth/dal";
import { getFeatureFlags, type FeatureFlags } from "@/lib/portal/features";

// Customer-side authorization, in one place:
//
//   logged-in user -> Customer Profile -> authorized Customer Accounts
//                  -> requested/selected account -> allow / deny
//
// Every portal page, server action and route handler that returns customer
// data must scope its queries with a PortalContext from here. The selected
// account lives in a cookie for convenience only — it is re-validated
// against the authorized list on every request, so editing the cookie (or a
// request parameter) can never reach another account's data.

export const SELECTED_ACCOUNT_COOKIE = "hn_account";

export type PortalAccount = {
  id: string;
  accountNumber: string;
  name: string;
  status: CustomerAccountStatus;
  starlinkVesselIds: string[];
};

export type PortalContext = {
  user: CurrentUser;
  profile: { id: string; name: string; company: string; customerId: string; email: string; address: string; phone: string };
  accounts: PortalAccount[];
  /** The account whose data the portal is showing. null only when the user has no accounts. */
  account: PortalAccount | null;
  features: FeatureFlags;
};

function toPortalAccount(a: {
  _id: Types.ObjectId;
  accountNumber: string;
  name?: string | null;
  status?: CustomerAccountStatus | null;
  starlinkVesselIds?: string[] | null;
}): PortalAccount {
  return {
    id: a._id.toString(),
    accountNumber: a.accountNumber,
    name: a.name ?? "",
    status: a.status ?? "ACTIVE",
    starlinkVesselIds: (a.starlinkVesselIds ?? []).filter(Boolean),
  };
}

/** Accounts a customer portal user may see, sorted by account number. */
export async function listAuthorizedAccounts(user: CurrentUser): Promise<PortalAccount[]> {
  if (user.role !== "CUSTOMER" || !user.customerProfileId) return [];
  await connectDB();
  const filter: Record<string, unknown> = { customer: user.customerProfileId };
  if (!user.accountAccessAll) {
    filter._id = { $in: user.accountAccess.filter((id) => isValidObjectId(id)) };
  }
  const accounts = await CustomerAccount.find(filter).sort({ accountNumber: 1 }).lean();
  return accounts.map(toPortalAccount);
}

async function buildContext(user: CurrentUser, requestedAccountId?: string | null): Promise<PortalContext> {
  await connectDB();
  const [accounts, profileDoc, features, cookieStore] = await Promise.all([
    listAuthorizedAccounts(user),
    User.findById(user.customerProfileId).select("name company customerId email address phone").lean(),
    getFeatureFlags(),
    cookies(),
  ]);

  const preferred = requestedAccountId ?? cookieStore.get(SELECTED_ACCOUNT_COOKIE)?.value ?? null;
  const account =
    accounts.find((a) => a.id === preferred) ??
    accounts.find((a) => a.status !== "CLOSED") ??
    accounts[0] ??
    null;

  return {
    user,
    profile: {
      id: user.customerProfileId as string,
      name: profileDoc?.name ?? user.name,
      company: profileDoc?.company ?? "",
      customerId: profileDoc?.customerId ?? "",
      email: profileDoc?.email ?? "",
      address: profileDoc?.address ?? "",
      phone: profileDoc?.phone ?? "",
    },
    accounts,
    account,
    features,
  };
}

/** For portal pages: redirects unauthenticated / non-customer users. */
export const getPortalContext = cache(async (): Promise<PortalContext> => {
  const user = await requireRole(["CUSTOMER"], "/admin");
  return buildContext(user);
});

/**
 * For server actions / route handlers: returns null instead of redirecting.
 * When `accountId` is given it must be one of the user's authorized accounts,
 * otherwise null is returned (deny).
 */
export async function getPortalContextForRequest(accountId?: string | null): Promise<PortalContext | null> {
  const user = await getAuthorizedUser(["CUSTOMER"]);
  if (!user) return null;
  const ctx = await buildContext(user, accountId ?? null);
  if (accountId && ctx.account?.id !== accountId) return null;
  return ctx;
}

/** True when the given account id belongs to the context's authorized accounts. */
export function canAccessAccount(ctx: PortalContext, accountId: string | null | undefined): boolean {
  return Boolean(accountId) && ctx.accounts.some((a) => a.id === accountId);
}
