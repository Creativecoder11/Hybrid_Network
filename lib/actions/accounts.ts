"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { CustomerAccount, normalizeAccountNumber } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { Invoice } from "@/models/Invoice";
import { UsageRecord } from "@/models/UsageRecord";
import { CdrRecord } from "@/models/CdrRecord";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { validateVesselIds } from "@/lib/accounts/vessels";
import { customerAccountSchema, parseList } from "@/lib/validations/account";
import type { ActionState } from "@/lib/actions/customers";

// Admin management of Customer Accounts (the account number = the Customer
// Code on CDR rows). Each account belongs to exactly one Customer Profile.

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readForm(formData: FormData) {
  return {
    id: str(formData, "id") || undefined,
    customerId: str(formData, "customerId"),
    accountNumber: str(formData, "accountNumber"),
    name: str(formData, "name"),
    status: (str(formData, "status") || "ACTIVE") as "ACTIVE" | "SUSPENDED" | "CLOSED",
    starlinkVesselIds: parseList(str(formData, "starlinkVesselIds")),
    slashAccountNumber: str(formData, "slashAccountNumber"),
    iccids: parseList(str(formData, "iccids")),
    cardName: str(formData, "cardName"),
    allowedProductCodes: parseList(str(formData, "allowedProductCodes")),
    notes: str(formData, "notes"),
    planId: str(formData, "planId") || null,
    staticIp: str(formData, "staticIp"),
  };
}

async function syncSubscription(accountId: mongoose.Types.ObjectId, customerId: string, planId: string | null, staticIp: string, adminId: string) {
  if (!planId) return;
  if (!mongoose.isValidObjectId(planId) || !(await ServicePlan.exists({ _id: planId }))) return;
  const active = await Subscription.findOne({ customerAccount: accountId, status: "ACTIVE" }).sort({ createdAt: -1 });
  if (active && active.plan.toString() === planId) {
    if (active.staticIp !== staticIp) {
      active.staticIp = staticIp;
      await active.save();
    }
    return;
  }
  if (active) {
    await ActivityLog.create({
      actor: adminId,
      targetCustomer: customerId,
      targetAccount: accountId,
      action: "PLAN_CHANGED",
      meta: { from: active.plan.toString(), to: planId },
    });
    active.plan = planId as unknown as typeof active.plan;
    active.staticIp = staticIp;
    await active.save();
    return;
  }
  await Subscription.create({ customer: customerId, customerAccount: accountId, plan: planId, status: "ACTIVE", staticIp });
}

export async function saveCustomerAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = customerAccountSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  const data = parsed.data;

  await connectDB();
  const profile = await User.findOne({ _id: data.customerId, ...CUSTOMER_PROFILE_FILTER }).select("_id").lean();
  if (!profile) return { error: "Customer not found." };

  const normalized = normalizeAccountNumber(data.accountNumber);
  const numberTaken = await CustomerAccount.findOne({
    accountNumberNormalized: normalized,
    ...(data.id ? { _id: { $ne: data.id } } : {}),
  })
    .select("customer")
    .lean();
  if (numberTaken) return { error: `Account number ${data.accountNumber} is already in use.` };

  const vesselError = await validateVesselIds(data.starlinkVesselIds, data.id);
  if (vesselError) return { error: vesselError };

  const fields = {
    accountNumber: data.accountNumber,
    name: data.name,
    status: data.status,
    starlinkVesselIds: data.starlinkVesselIds,
    slashAccountNumber: data.slashAccountNumber,
    iccids: data.iccids,
    cardName: data.cardName,
    allowedProductCodes: data.allowedProductCodes,
    notes: data.notes,
  };

  let account;
  if (data.id) {
    account = await CustomerAccount.findOne({ _id: data.id, customer: data.customerId });
    if (!account) return { error: "Customer Account not found." };
    const before = { accountNumber: account.accountNumber, status: account.status, vessels: [...account.starlinkVesselIds] };
    account.set(fields);
    await account.save();
    await ActivityLog.create({
      actor: admin.id,
      targetCustomer: data.customerId,
      targetAccount: account._id,
      action: "CUSTOMER_ACCOUNT_UPDATED",
      meta: { before, after: { accountNumber: account.accountNumber, status: account.status, vessels: account.starlinkVesselIds } },
    });
  } else {
    account = await CustomerAccount.create({ ...fields, customer: data.customerId, createdBy: admin.id });
    await ActivityLog.create({
      actor: admin.id,
      targetCustomer: data.customerId,
      targetAccount: account._id,
      action: "CUSTOMER_ACCOUNT_CREATED",
      meta: { accountNumber: account.accountNumber, vessels: account.starlinkVesselIds },
    });
  }

  await syncSubscription(account._id, data.customerId, data.planId ?? null, data.staticIp, admin.id);

  revalidatePath(`/admin/customers/${data.customerId}`);
  revalidatePath("/admin/customers");
  return { success: data.id ? "Customer Account updated." : `Customer Account ${account.accountNumber} created.` };
}

/**
 * Deletes an account only when nothing references it. Accounts with bills,
 * usage or CDR history must be CLOSED instead, so tax invoices and audit
 * trails keep pointing at a real account.
 */
export async function deleteCustomerAccountAction(accountId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete Customer Accounts." };
  if (!mongoose.isValidObjectId(accountId)) return { error: "Customer Account not found." };

  await connectDB();
  const account = await CustomerAccount.findById(accountId);
  if (!account) return { error: "Customer Account not found." };

  const [invoices, usage, cdr, charges] = await Promise.all([
    // Raw collection count: includes invoices in the Trash, which the model's
    // soft-delete hook would otherwise hide.
    Invoice.collection.countDocuments({ customerAccount: account._id }),
    UsageRecord.countDocuments({ customerAccount: account._id }),
    CdrRecord.countDocuments({ customerAccount: account._id }),
    CdrChargeRecord.countDocuments({ customerAccount: account._id }),
  ]);
  if (invoices + usage + cdr + charges > 0) {
    return { error: "This account has billing, usage or CDR history. Set its status to Closed instead of deleting it." };
  }

  await Promise.all([
    Subscription.deleteMany({ customerAccount: account._id }),
    User.updateMany({ accountAccess: account._id }, { $pull: { accountAccess: account._id } }),
    CustomerAccount.deleteOne({ _id: account._id }),
  ]);
  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: account.customer,
    action: "CUSTOMER_ACCOUNT_DELETED",
    meta: { accountNumber: account.accountNumber },
  });

  revalidatePath(`/admin/customers/${account.customer.toString()}`);
  return { success: `Customer Account ${account.accountNumber} deleted.` };
}
