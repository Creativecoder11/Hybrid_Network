"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPortalContextForRequest, SELECTED_ACCOUNT_COOKIE } from "@/lib/accounts/access";
import type { ActionState } from "@/lib/actions/customers";

/**
 * Switches the customer portal to another of the user's Customer Accounts.
 * The id is checked against the user's authorized accounts first; the cookie
 * only remembers the choice and is re-validated on every request.
 */
export async function selectPortalAccountAction(accountId: string): Promise<ActionState> {
  if (typeof accountId !== "string" || !/^[a-f0-9]{24}$/i.test(accountId)) return { error: "Account not found." };
  const ctx = await getPortalContextForRequest(accountId);
  if (!ctx) return { error: "You don't have access to that account." };

  const cookieStore = await cookies();
  cookieStore.set(SELECTED_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath("/portal", "layout");
  return { success: `Showing account ${ctx.account?.accountNumber}.` };
}
