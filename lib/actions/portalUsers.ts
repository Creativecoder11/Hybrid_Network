"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { CustomerAccount } from "@/models/CustomerAccount";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { sendCustomerInvitation } from "@/lib/auth/temporaryCredentials";
import { accountAccessSchema, portalUserSchema } from "@/lib/validations/account";
import type { ActionState } from "@/lib/actions/customers";

// Customer portal logins. A Customer Profile's own user is its primary login;
// additional logins for the same company are CUSTOMER users linked by
// `customerProfile`. Each login has its own account access list.

const ADMINS = ["SUPER_ADMIN", "SUB_ADMIN"] as const;

function readAccountIds(formData: FormData): string[] {
  return formData.getAll("accountIds").map((v) => String(v)).filter(Boolean);
}

/** Only accounts that belong to the profile may be granted. */
async function accountsOfProfile(profileId: string, accountIds: string[]): Promise<string[] | null> {
  if (accountIds.length === 0) return [];
  const found = await CustomerAccount.find({ _id: { $in: accountIds }, customer: profileId }).select("_id").lean();
  return found.length === new Set(accountIds).size ? found.map((a) => a._id.toString()) : null;
}

/** The profile this login belongs to (itself for a primary login). */
function profileIdOf(user: { _id: mongoose.Types.ObjectId; customerProfile?: mongoose.Types.ObjectId | null }): string {
  return (user.customerProfile ?? user._id).toString();
}

export async function createPortalUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAuthorizedUser([...ADMINS]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = portalUserSchema.safeParse({
    profileId: String(formData.get("profileId") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    accountAccessAll: formData.get("accountAccessAll") === "on",
    accountIds: readAccountIds(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  const data = parsed.data;

  await connectDB();
  const profile = await User.findOne({ _id: data.profileId, ...CUSTOMER_PROFILE_FILTER });
  if (!profile) return { error: "Customer not found." };
  if (profile.status === "SUSPENDED") return { error: "Reactivate the customer before adding portal users." };
  if (await User.exists({ email: data.email })) return { error: "A user with this email already exists." };

  const accountIds = data.accountAccessAll ? [] : await accountsOfProfile(data.profileId, data.accountIds);
  if (accountIds === null) return { error: "One or more selected accounts don't belong to this customer." };

  const user = await User.create({
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: "CUSTOMER",
    status: "INVITED",
    company: profile.company,
    customerProfile: profile._id,
    accountAccessAll: data.accountAccessAll,
    accountAccess: accountIds,
    createdBy: admin.id,
  });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: profile._id,
    action: "PORTAL_USER_CREATED",
    meta: { userId: user._id.toString(), email: user.email, accountAccessAll: data.accountAccessAll, accountIds },
  });

  const invite = await sendCustomerInvitation(user, { actorId: admin.id, reason: "USER_CREATED" });
  revalidatePath(`/admin/customers/${data.profileId}`);
  if (!invite.success) return { error: `User created, but ${invite.error?.toLowerCase() ?? "the invitation could not be sent."}` };
  return {
    success: invite.delivered
      ? `Portal user created. Invitation emailed to ${user.email}.`
      : `Portal user created. SMTP isn't configured, so the invitation email was not delivered — configure SMTP and re-invite.`,
  };
}

export async function updateAccountAccessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAuthorizedUser([...ADMINS]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = accountAccessSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
    accountAccessAll: formData.get("accountAccessAll") === "on",
    accountIds: readAccountIds(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };

  await connectDB();
  const user = await User.findOne({ _id: parsed.data.userId, role: "CUSTOMER" });
  if (!user) return { error: "Portal user not found." };
  const profileId = profileIdOf(user);

  const accountIds = parsed.data.accountAccessAll ? [] : await accountsOfProfile(profileId, parsed.data.accountIds);
  if (accountIds === null) return { error: "One or more selected accounts don't belong to this customer." };

  const before = { accountAccessAll: user.accountAccessAll, accountAccess: user.accountAccess.map(String) };
  user.accountAccessAll = parsed.data.accountAccessAll;
  user.accountAccess = accountIds as unknown as typeof user.accountAccess;
  await user.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: profileId,
    action: "ACCOUNT_ACCESS_UPDATED",
    meta: { userId: user._id.toString(), email: user.email, before, after: { accountAccessAll: user.accountAccessAll, accountAccess: accountIds } },
  });

  revalidatePath(`/admin/customers/${profileId}`);
  return { success: "Account access updated." };
}

async function loadAdditionalUser(userId: string) {
  if (!mongoose.isValidObjectId(userId)) return null;
  return User.findOne({ _id: userId, role: "CUSTOMER", customerProfile: { $ne: null } });
}

export async function setPortalUserSuspendedAction(userId: string, suspended: boolean): Promise<ActionState> {
  const admin = await getAuthorizedUser([...ADMINS]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const user = await loadAdditionalUser(userId);
  if (!user) return { error: "Portal user not found. (The primary login is suspended with the customer.)" };

  if (suspended) {
    user.status = "SUSPENDED";
  } else {
    // Back to INVITED if they never completed the first-login change.
    user.status = user.mustChangePassword ? "INVITED" : "ACTIVE";
  }
  await user.save();

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: user.customerProfile,
    action: suspended ? "PORTAL_USER_SUSPENDED" : "PORTAL_USER_REACTIVATED",
    meta: { userId, email: user.email },
  });
  revalidatePath(`/admin/customers/${profileIdOf(user)}`);
  return { success: suspended ? `${user.name} suspended.` : `${user.name} reactivated.` };
}

export async function deletePortalUserAction(userId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete portal users." };

  await connectDB();
  const user = await loadAdditionalUser(userId);
  if (!user) return { error: "Portal user not found. (The primary login is deleted with the customer.)" };

  await User.deleteOne({ _id: user._id });
  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: user.customerProfile,
    action: "PORTAL_USER_DELETED",
    meta: { userId, email: user.email, name: user.name },
  });
  revalidatePath(`/admin/customers/${profileIdOf(user)}`);
  return { success: `${user.name} deleted. Their sessions end immediately.` };
}

/** Re-sends the invitation (fresh temporary password) to a login that hasn't activated yet. */
export async function reinvitePortalUserAction(userId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser([...ADMINS]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(userId)) return { error: "Portal user not found." };

  await connectDB();
  const user = await User.findOne({ _id: userId, role: "CUSTOMER" }).select("+passwordHash");
  if (!user) return { error: "Portal user not found." };
  if (user.status === "SUSPENDED") return { error: "Reactivate this user before re-inviting them." };
  if (user.status === "ACTIVE" && !user.mustChangePassword) {
    return { error: "This user has already set their own password. They can use “Forgot password” to reset it." };
  }

  const res = await sendCustomerInvitation(user, { actorId: admin.id, reason: "RE_INVITE" });
  revalidatePath(`/admin/customers/${profileIdOf(user)}`);
  if (!res.success) return { error: res.error ?? "The invitation could not be sent." };
  return {
    success: res.delivered
      ? `Invitation re-sent to ${user.email}. The previous temporary password no longer works.`
      : "A new temporary password was issued, but SMTP isn't configured so the email was not delivered.",
  };
}
