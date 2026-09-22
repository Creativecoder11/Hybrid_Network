"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { CustomerAccount, normalizeAccountNumber } from "@/models/CustomerAccount";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import { Invoice } from "@/models/Invoice";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { generateCustomerId } from "@/lib/utils/ids";
import { sendCustomerInvitation } from "@/lib/auth/temporaryCredentials";
import { parseList } from "@/lib/validations/account";
import { validateVesselIds } from "@/lib/accounts/vessels";
import { createCustomerSchema, updateCustomerSchema, manualUsageSchema } from "@/lib/validations/customer";

export type ActionState = { error?: string; success?: string } | undefined;

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
    accountType: str(formData, "accountType") || null,
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
    planId: str(formData, "planId") || null,
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
    return { success: `Customer created, but the invitation could not be sent (${invite.error}). Use "Re-send invitation".` };
  }
  return {
    success: invite.delivered
      ? `Customer created. Invitation with a temporary password sent to ${data.email}.`
      : "Customer created. SMTP isn't configured, so the invitation email was not delivered — configure SMTP and re-send the invitation.",
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

  const parsed = updateCustomerSchema.safeParse({
    id,
    ...profileFields(formData),
    status: (str(formData, "status") || undefined) as "ACTIVE" | "SUSPENDED" | "INVITED" | undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const customer = await User.findOne({ _id: id, ...CUSTOMER_PROFILE_FILTER });
  if (!customer) return { error: "Customer not found." };

  if (parsed.data.email && parsed.data.email.toLowerCase() !== customer.email) {
    const emailTaken = await User.exists({ email: parsed.data.email.toLowerCase(), _id: { $ne: id } });
    if (emailTaken) return { error: "Another user already uses this email." };
  }

  const before = { name: customer.name, email: customer.email, status: customer.status };

  customer.name = parsed.data.name ?? customer.name;
  customer.email = parsed.data.email ? parsed.data.email.toLowerCase() : customer.email;
  customer.phone = parsed.data.phone ?? customer.phone;
  customer.address = parsed.data.address ?? customer.address;
  customer.company = parsed.data.company ?? customer.company;
  customer.accountType = (parsed.data.accountType as typeof customer.accountType) ?? customer.accountType;
  customer.contactPerson = parsed.data.contactPerson ?? customer.contactPerson;
  customer.nidTradeLicense = parsed.data.nidTradeLicense ?? customer.nidTradeLicense;
  customer.cardName = parsed.data.cardName ?? customer.cardName;
  customer.iccid = parsed.data.iccid ?? customer.iccid;
  customer.imei = parsed.data.imei ?? customer.imei;
  customer.service = parsed.data.service ?? customer.service;
  customer.vendor = parsed.data.vendor ?? customer.vendor;
  if (parsed.data.network) customer.network = parsed.data.network;

  // The status pills never resurrect an INVITED login into ACTIVE (that only
  // happens when the customer completes the first-login password change).
  if (parsed.data.status && parsed.data.status !== "INVITED" && customer.status !== "INVITED") {
    customer.status = parsed.data.status;
  } else if (parsed.data.status === "SUSPENDED") {
    customer.status = "SUSPENDED";
  }

  await customer.save();

  // Keep additional portal users' company label in step with the profile.
  await User.updateMany({ customerProfile: customer._id }, { $set: { company: customer.company } });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: before.status !== customer.status ? (customer.status === "SUSPENDED" ? "CUSTOMER_SUSPENDED" : "CUSTOMER_REACTIVATED") : "CUSTOMER_UPDATED",
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
