"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { CustomerAccount, normalizeAccountNumber } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { ServicePlan } from "@/models/ServicePlan";
import { UsageRecord } from "@/models/UsageRecord";
import { Invoice } from "@/models/Invoice";
import { CdrRecord } from "@/models/CdrRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { generateCustomerId } from "@/lib/utils/ids";
import { sendCustomerInvitation } from "@/lib/auth/temporaryCredentials";
import { parseList } from "@/lib/validations/account";
import { validateVesselIds } from "@/lib/accounts/vessels";
import { createCustomerSchema, updateCustomerSchema, manualUsageSchema } from "@/lib/validations/customer";

export type ActionState =
  | {
      error?: string;
      success?: string;
      customerCreated?: {
        id: string;
        customerId: string;
        name: string;
        email: string;
        accountNumbers: string[];
        emailDelivered: boolean;
        error?: string;
      };
    }
  | undefined;

// Customer Profiles. A profile (User, role CUSTOMER, no customerProfile link)
// holds the company details and is also the primary portal login. Its
// Customer Accounts are managed in lib/actions/accounts.ts and additional
// logins in lib/actions/portalUsers.ts.

const GB = 1_000_000_000;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function numOrUndefined(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function buildNetworkFromForm(formData: FormData) {
  return {
    originNumber: str(formData, "originNumber"),
    originCountry: str(formData, "originCountry"),
    originIpAddress: str(formData, "originIpAddress"),
    originRegion: str(formData, "originRegion"),
    originState: str(formData, "originState"),
    destinationNumber: str(formData, "destinationNumber"),
    destinationNetwork: str(formData, "destinationNetwork"),
    destinationCountry: str(formData, "destinationCountry"),
    destinationState: str(formData, "destinationState"),
  };
}

function profileFields(formData: FormData) {
  return {
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    address: str(formData, "address"),
    company: str(formData, "company"),
    accountType: str(formData, "accountType") || undefined,
    contactPerson: str(formData, "contactPerson"),
    nidTradeLicense: str(formData, "nidTradeLicense"),
    cardName: str(formData, "cardName"),
    iccid: str(formData, "iccid"),
    imei: str(formData, "imei"),
    service: str(formData, "service"),
    vendor: str(formData, "vendor"),
    network: buildNetworkFromForm(formData),
  };
}

export async function createCustomerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = createCustomerSchema.safeParse({
    ...profileFields(formData),
    accountNumbers: parseList(str(formData, "accountNumbers")),
    starlinkVesselId: str(formData, "starlinkVesselId"),
    planId: str(formData, "planId"),
    staticIp: str(formData, "staticIp"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;

  await connectDB();

  if (await User.exists({ email: data.email.toLowerCase() })) {
    return { error: "A user with this email already exists." };
  }

  const normalizedNumbers = data.accountNumbers.map(normalizeAccountNumber);
  if (new Set(normalizedNumbers).size !== normalizedNumbers.length) {
    return { error: "The same Customer Account number is listed twice." };
  }
  if (normalizedNumbers.length > 0) {
    const taken = await CustomerAccount.findOne({ accountNumberNormalized: { $in: normalizedNumbers } }).select("accountNumber").lean();
    if (taken) return { error: `Customer Account number ${taken.accountNumber} is already in use.` };
  }
  if (data.starlinkVesselId) {
    if (data.accountNumbers.length === 0) return { error: "Add a Customer Account number to link the Starlink vessel to." };
    const vesselError = await validateVesselIds([data.starlinkVesselId]);
    if (vesselError) return { error: vesselError };
  }

  const customerId = await generateCustomerId();
  const customer = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    role: "CUSTOMER",
    customerId,
    status: "INVITED",
    address: data.address,
    company: data.company,
    createdBy: admin.id,
    accountType: data.accountType || undefined,
    contactPerson: data.contactPerson,
    nidTradeLicense: data.nidTradeLicense,
    cardName: data.cardName,
    iccid: data.iccid,
    imei: data.imei,
    service: data.service,
    vendor: data.vendor,
    network: data.network,
    customerProfile: null,
    accountAccessAll: true,
  });

  const accounts = [];
  for (let i = 0; i < data.accountNumbers.length; i++) {
    const account = await CustomerAccount.create({
      customer: customer._id,
      accountNumber: data.accountNumbers[i],
      status: "ACTIVE",
      starlinkVesselIds: i === 0 && data.starlinkVesselId ? [data.starlinkVesselId] : [],
      iccids: i === 0 && data.iccid ? [data.iccid] : [],
      cardName: i === 0 ? data.cardName : "",
      createdBy: admin.id,
    });
    accounts.push(account);
    await ActivityLog.create({
      actor: admin.id,
      targetCustomer: customer._id,
      targetAccount: account._id,
      action: "CUSTOMER_ACCOUNT_CREATED",
      meta: { accountNumber: account.accountNumber },
    });
  }

  if (data.planId && mongoose.isValidObjectId(data.planId) && accounts[0]) {
    await Subscription.create({
      customer: customer._id,
      customerAccount: accounts[0]._id,
      plan: data.planId,
      status: "ACTIVE",
      staticIp: data.staticIp,
      terminalIds: data.iccid ? [data.iccid] : [],
    });
  }

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "CUSTOMER_CREATED",
    meta: { customerId, email: data.email, accountNumbers: data.accountNumbers },
  });

  const invite = await sendCustomerInvitation(customer, { actorId: admin.id, reason: "USER_CREATED" });

  revalidatePath("/admin/customers");
  if (!invite.success) {
    return {
      success: `Customer created, but the invitation could not be sent (${invite.error}). Use "Re-send invitation".`,
      customerCreated: {
        id: customer._id.toString(),
        customerId: customer.customerId || "",
        name: data.name,
        email: data.email,
        accountNumbers: data.accountNumbers,
        emailDelivered: false,
        error: invite.error,
      },
    };
  }
  return {
    success: invite.delivered
      ? `Customer created. Invitation with a temporary password sent to ${data.email}.`
      : "Customer created. SMTP isn't configured, so the invitation email was not delivered — configure SMTP and re-send the invitation.",
    customerCreated: {
      id: customer._id.toString(),
      customerId: customer.customerId || "",
      name: data.name,
      email: data.email,
      accountNumbers: data.accountNumbers,
      emailDelivered: Boolean(invite.delivered),
      error: invite.error,
    },
  };
}

export async function updateCustomerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const id = str(formData, "id");
  if (!mongoose.isValidObjectId(id)) return { error: "Missing customer id." };

  const rawAccountNumbers = parseList(str(formData, "accountNumbers"));
  const starlinkVesselId = str(formData, "starlinkVesselId");
  const planId = str(formData, "planId");
  const staticIp = str(formData, "staticIp");

  const parsed = updateCustomerSchema.safeParse({
    id,
    ...profileFields(formData),
    status: (str(formData, "status") || undefined) as "ACTIVE" | "SUSPENDED" | "INVITED" | undefined,
    accountNumbers: rawAccountNumbers,
    starlinkVesselId,
    planId,
    staticIp,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;

  await connectDB();
  const customer = await User.findOne({ _id: id, ...CUSTOMER_PROFILE_FILTER });
  if (!customer) return { error: "Customer not found." };

  if (data.email && data.email.toLowerCase() !== customer.email) {
    const emailTaken = await User.exists({ email: data.email.toLowerCase(), _id: { $ne: id } });
    if (emailTaken) return { error: "Another user already uses this email." };
  }

  const normalizedNumbers = (data.accountNumbers ?? []).map(normalizeAccountNumber);
  if (new Set(normalizedNumbers).size !== normalizedNumbers.length) {
    return { error: "The same Customer Account number is listed twice." };
  }
  if (normalizedNumbers.length > 0) {
    const taken = await CustomerAccount.findOne({
      accountNumberNormalized: { $in: normalizedNumbers },
      customer: { $ne: customer._id },
    })
      .select("accountNumber")
      .lean();
    if (taken) return { error: `Customer Account number ${taken.accountNumber} is already in use by another customer.` };
  }

  if (data.starlinkVesselId) {
    const vesselError = await validateVesselIds([data.starlinkVesselId]);
    if (vesselError) return { error: vesselError };
  }

  const before = { name: customer.name, email: customer.email, status: customer.status };

  customer.name = data.name ?? customer.name;
  customer.email = data.email ? data.email.toLowerCase() : customer.email;
  customer.phone = data.phone ?? customer.phone;
  customer.address = data.address ?? customer.address;
  customer.company = data.company ?? customer.company;
  customer.accountType = (data.accountType as typeof customer.accountType) ?? customer.accountType;
  customer.contactPerson = data.contactPerson ?? customer.contactPerson;
  customer.nidTradeLicense = data.nidTradeLicense ?? customer.nidTradeLicense;
  customer.cardName = data.cardName ?? customer.cardName;
  customer.iccid = data.iccid ?? customer.iccid;
  customer.imei = data.imei ?? customer.imei;
  customer.service = data.service ?? customer.service;
  customer.vendor = data.vendor ?? customer.vendor;
  customer.starlinkVesselId = data.starlinkVesselId ?? customer.starlinkVesselId;
  if (data.accountNumbers && data.accountNumbers.length > 0) {
    customer.customerCode = data.accountNumbers[0];
  }
  if (data.network) customer.network = data.network;

  // The status pills never resurrect an INVITED login into ACTIVE (that only
  // happens when the customer completes the first-login password change).
  if (data.status && data.status !== "INVITED" && customer.status !== "INVITED") {
    customer.status = data.status;
  } else if (data.status === "SUSPENDED") {
    customer.status = "SUSPENDED";
  }

  await customer.save();

  // Keep additional portal users' company label in step with the profile.
  await User.updateMany({ customerProfile: customer._id }, { $set: { company: customer.company } });

  // Sync Customer Accounts
  const existingAccounts = await CustomerAccount.find({ customer: customer._id }).sort({ createdAt: 1 });
  const accountNumbers = data.accountNumbers ?? [];

  if (accountNumbers.length > 0) {
    for (let i = 0; i < accountNumbers.length; i++) {
      const accNum = accountNumbers[i];
      if (existingAccounts[i]) {
        existingAccounts[i].accountNumber = accNum;
        if (i === 0) {
          existingAccounts[0].starlinkVesselIds = data.starlinkVesselId ? [data.starlinkVesselId] : [];
          if (data.iccid) existingAccounts[0].iccids = [data.iccid];
          if (data.cardName) existingAccounts[0].cardName = data.cardName;
        }
        await existingAccounts[i].save();
      } else {
        const newAccount = await CustomerAccount.create({
          customer: customer._id,
          accountNumber: accNum,
          status: "ACTIVE",
          starlinkVesselIds: i === 0 && data.starlinkVesselId ? [data.starlinkVesselId] : [],
          iccids: i === 0 && data.iccid ? [data.iccid] : [],
          cardName: i === 0 ? data.cardName : "",
          createdBy: admin.id,
        });
        existingAccounts.push(newAccount);
        await ActivityLog.create({
          actor: admin.id,
          targetCustomer: customer._id,
          targetAccount: newAccount._id,
          action: "CUSTOMER_ACCOUNT_CREATED",
          meta: { accountNumber: newAccount.accountNumber },
        });
      }
    }

    // Clean up extra accounts if they are safe to delete
    if (existingAccounts.length > accountNumbers.length) {
      for (let i = accountNumbers.length; i < existingAccounts.length; i++) {
        const extraAccount = existingAccounts[i];
        const [invCount, usageCount, cdrCount] = await Promise.all([
          Invoice.collection.countDocuments({ customerAccount: extraAccount._id }),
          UsageRecord.countDocuments({ customerAccount: extraAccount._id }),
          CdrRecord.countDocuments({ customerAccount: extraAccount._id }),
        ]);
        if (invCount === 0 && usageCount === 0 && cdrCount === 0) {
          await Subscription.deleteMany({ customerAccount: extraAccount._id });
          await User.updateMany({ accountAccess: extraAccount._id }, { $pull: { accountAccess: extraAccount._id } });
          await CustomerAccount.deleteOne({ _id: extraAccount._id });
        }
      }
    }
  } else if (existingAccounts.length > 0) {
    if (data.starlinkVesselId !== undefined) {
      existingAccounts[0].starlinkVesselIds = data.starlinkVesselId ? [data.starlinkVesselId] : [];
    }
    if (data.iccid) existingAccounts[0].iccids = [data.iccid];
    if (data.cardName) existingAccounts[0].cardName = data.cardName;
    await existingAccounts[0].save();
  }

  // Sync Subscription for the primary account
  const primaryAccount = existingAccounts[0] || (await CustomerAccount.findOne({ customer: customer._id }).sort({ createdAt: 1 }));
  if (primaryAccount) {
    const activeSub = await Subscription.findOne({
      customer: customer._id,
      customerAccount: primaryAccount._id,
      status: "ACTIVE",
    }).sort({ createdAt: -1 });

    if (data.planId && mongoose.isValidObjectId(data.planId) && (await ServicePlan.exists({ _id: data.planId }))) {
      if (activeSub) {
        if (activeSub.plan.toString() !== data.planId) {
          await ActivityLog.create({
            actor: admin.id,
            targetCustomer: customer._id,
            targetAccount: primaryAccount._id,
            action: "PLAN_CHANGED",
            meta: { from: activeSub.plan.toString(), to: data.planId },
          });
          activeSub.plan = data.planId as unknown as typeof activeSub.plan;
        }
        activeSub.staticIp = data.staticIp ?? "";
        if (data.iccid) activeSub.terminalIds = [data.iccid];
        await activeSub.save();
      } else {
        await Subscription.create({
          customer: customer._id,
          customerAccount: primaryAccount._id,
          plan: data.planId,
          status: "ACTIVE",
          staticIp: data.staticIp ?? "",
          terminalIds: data.iccid ? [data.iccid] : [],
        });
      }
    } else if (activeSub) {
      activeSub.staticIp = data.staticIp ?? "";
      if (data.iccid) activeSub.terminalIds = [data.iccid];
      await activeSub.save();
    }
  }

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action:
      before.status !== customer.status
        ? customer.status === "SUSPENDED"
          ? "CUSTOMER_SUSPENDED"
          : "CUSTOMER_REACTIVATED"
        : "CUSTOMER_UPDATED",
    meta: { before, after: { name: customer.name, email: customer.email, status: customer.status } },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return { success: "Customer updated." };
}

/**
 * Deletes a Customer Profile, its additional portal users, accounts and
 * subscriptions. Refused while the customer has invoices — tax invoices must
 * keep their customer; suspend the customer instead.
 */
export async function deleteCustomerAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete customers." };
  if (!mongoose.isValidObjectId(customerId)) return { error: "Customer not found." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, ...CUSTOMER_PROFILE_FILTER });
  if (!customer) return { error: "Customer not found." };

  const invoiceCount = await Invoice.collection.countDocuments({ customer: customer._id });
  if (invoiceCount > 0) {
    return {
      error: `This customer has ${invoiceCount} invoice(s) on record. Suspend the customer instead so billing history is preserved.`,
    };
  }

  const accountIds = (await CustomerAccount.find({ customer: customer._id }).select("_id").lean()).map((a) => a._id);
  await Promise.all([
    Subscription.deleteMany({ customer: customer._id }),
    UsageRecord.deleteMany({ customer: customer._id }),
    CustomerAccount.deleteMany({ customer: customer._id }),
    User.deleteMany({ customerProfile: customer._id }),
  ]);
  await User.deleteOne({ _id: customer._id });

  await ActivityLog.create({
    actor: admin.id,
    action: "CUSTOMER_DELETED",
    meta: { customerId: customer.customerId, email: customer.email, name: customer.name, accountsDeleted: accountIds.length },
  });

  revalidatePath("/admin/customers");
  return { success: "Customer deleted." };
}

export async function suspendCustomerAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(customerId)) return { error: "Customer not found." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, ...CUSTOMER_PROFILE_FILTER });
  if (!customer) return { error: "Customer not found." };

  customer.status = "SUSPENDED";
  await customer.save();

  await ActivityLog.create({ actor: admin.id, targetCustomer: customer._id, action: "CUSTOMER_SUSPENDED" });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { success: "Customer suspended. All of the customer's portal users are signed out." };
}

export async function reactivateCustomerAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(customerId)) return { error: "Customer not found." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, ...CUSTOMER_PROFILE_FILTER });
  if (!customer) return { error: "Customer not found." };

  // A login that never completed its first password change goes back to INVITED.
  customer.status = customer.mustChangePassword ? "INVITED" : "ACTIVE";
  await customer.save();

  await ActivityLog.create({ actor: admin.id, targetCustomer: customer._id, action: "CUSTOMER_REACTIVATED" });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { success: "Customer reactivated." };
}

/** Re-sends the primary login's invitation (new temporary password). */
export async function resendInviteAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!mongoose.isValidObjectId(customerId)) return { error: "Customer not found." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, ...CUSTOMER_PROFILE_FILTER }).select("+passwordHash");
  if (!customer) return { error: "Customer not found." };
  if (customer.status === "ACTIVE" && !customer.mustChangePassword) {
    return { error: "This customer has already activated their login. They can use “Forgot password” to reset it." };
  }

  const res = await sendCustomerInvitation(customer, { actorId: admin.id, reason: "RE_INVITE" });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  if (!res.success) return { error: res.error ?? "The invitation could not be sent." };
  return {
    success: res.delivered
      ? `Invitation re-sent to ${customer.email}. The previous temporary password no longer works.`
      : "A new temporary password was issued, but SMTP isn't configured so the email was not delivered.",
  };
}

export async function updateManualUsageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const gb = (key: string) => {
    const v = numOrUndefined(formData, key);
    return v === undefined ? undefined : Math.round(v * GB);
  };

  const parsed = manualUsageSchema.safeParse({
    customerId: str(formData, "customerId"),
    customerAccountId: str(formData, "customerAccountId"),
    periodMonth: str(formData, "periodMonth"),
    volumeDataBytes: gb("volumeDataBytesGb"),
    volumeMin: numOrUndefined(formData, "volumeMin"),
    volumeMsg: numOrUndefined(formData, "volumeMsg"),
    volumeInBundleBytes: gb("volumeInBundleBytesGb"),
    volumeOutBundleBytes: gb("volumeOutBundleBytesGb"),
    volumeTotalBytes: gb("volumeTotalBytesGb"),
    consumptionMoney: numOrUndefined(formData, "consumptionMoney"),
    consumptionDataBytes: gb("consumptionDataBytesGb"),
    consumptionMin: numOrUndefined(formData, "consumptionMin"),
    consumptionMsg: numOrUndefined(formData, "consumptionMsg"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the values and try again." };
  }

  await connectDB();
  const { customerId, customerAccountId, periodMonth, ...fields } = parsed.data;
  const account = await CustomerAccount.findOne({ _id: customerAccountId, customer: customerId }).select("_id").lean();
  if (!account) return { error: "Customer Account not found for this customer." };

  const filter = { customer: customerId, customerAccount: customerAccountId, periodMonth };
  const existing = await UsageRecord.findOne(filter);
  const before = existing ? existing.toObject() : null;

  const update: Record<string, unknown> = { lastUpdatedBy: admin.id };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) update[k] = v;
  }
  update.source = before?.source === "CDR" || before?.source === "CDR+MANUAL" ? "CDR+MANUAL" : "MANUAL";

  const after = await UsageRecord.findOneAndUpdate(
    filter,
    { $set: update, $setOnInsert: filter },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customerId,
    targetAccount: customerAccountId,
    action: "USAGE_MANUAL_UPDATE",
    meta: { periodMonth, before, after: after.toObject() },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  return { success: `Usage for ${periodMonth} updated.` };
}
