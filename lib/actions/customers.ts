"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Subscription } from "@/models/Subscription";
import { UsageRecord } from "@/models/UsageRecord";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { generateCustomerId } from "@/lib/utils/ids";
import { issueInvite } from "@/lib/auth/invite";
import { createCustomerSchema, updateCustomerSchema, manualUsageSchema } from "@/lib/validations/customer";

export type ActionState = { error?: string; success?: string } | undefined;

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

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
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

export async function createCustomerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const raw = {
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    address: str(formData, "address"),
    company: str(formData, "company"),
    accountType: str(formData, "accountType") || null,
    contactPerson: str(formData, "contactPerson"),
    nidTradeLicense: str(formData, "nidTradeLicense"),
    customerCode: str(formData, "customerCode"),
    cardName: str(formData, "cardName"),
    iccid: str(formData, "iccid"),
    imei: str(formData, "imei"),
    service: str(formData, "service"),
    vendor: str(formData, "vendor"),
    network: buildNetworkFromForm(formData),
    planId: str(formData, "planId") || null,
    staticIp: str(formData, "staticIp"),
  };

  const parsed = createCustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();

  const existing = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (existing) {
    return { error: "A user with this email already exists." };
  }

  if (parsed.data.customerCode) {
    const codeTaken = await User.exists({ customerCode: parsed.data.customerCode });
    if (codeTaken) return { error: "This Customer Code is already assigned to another account." };
  }

  const customerId = await generateCustomerId();

  const customer = await User.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone,
    role: "CUSTOMER",
    customerId,
    status: "INVITED",
    address: parsed.data.address,
    company: parsed.data.company,
    createdBy: admin.id,
    accountType: parsed.data.accountType || undefined,
    contactPerson: parsed.data.contactPerson,
    nidTradeLicense: parsed.data.nidTradeLicense,
    customerCode: parsed.data.customerCode || undefined,
    cardName: parsed.data.cardName,
    iccid: parsed.data.iccid,
    imei: parsed.data.imei,
    service: parsed.data.service,
    vendor: parsed.data.vendor,
    network: parsed.data.network,
  });

  if (parsed.data.planId) {
    await Subscription.create({
      customer: customer._id,
      plan: parsed.data.planId,
      status: "ACTIVE",
      staticIp: parsed.data.staticIp,
      terminalIds: parsed.data.iccid ? [parsed.data.iccid] : [],
    });
  }

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "CUSTOMER_CREATED",
    meta: { customerId, email: parsed.data.email },
  });

  try {
    await issueInvite(customer);
  } catch (err) {
    console.error("Failed to send invite email", err);
  }

  revalidatePath("/admin/customers");
  return { success: `Customer created. Invitation sent to ${parsed.data.email}.` };
}

export async function updateCustomerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const id = str(formData, "id");
  if (!id) return { error: "Missing customer id." };

  const raw = {
    id,
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    address: str(formData, "address"),
    company: str(formData, "company"),
    accountType: str(formData, "accountType") || null,
    contactPerson: str(formData, "contactPerson"),
    nidTradeLicense: str(formData, "nidTradeLicense"),
    customerCode: str(formData, "customerCode"),
    cardName: str(formData, "cardName"),
    iccid: str(formData, "iccid"),
    imei: str(formData, "imei"),
    service: str(formData, "service"),
    vendor: str(formData, "vendor"),
    network: buildNetworkFromForm(formData),
    planId: str(formData, "planId") || null,
    staticIp: str(formData, "staticIp"),
    status: (str(formData, "status") || undefined) as "ACTIVE" | "SUSPENDED" | "INVITED" | undefined,
  };

  const parsed = updateCustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const customer = await User.findOne({ _id: id, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };

  if (parsed.data.email && parsed.data.email.toLowerCase() !== customer.email) {
    const emailTaken = await User.exists({ email: parsed.data.email.toLowerCase(), _id: { $ne: id } });
    if (emailTaken) return { error: "Another user already uses this email." };
  }
  if (parsed.data.customerCode && parsed.data.customerCode !== customer.customerCode) {
    const codeTaken = await User.exists({ customerCode: parsed.data.customerCode, _id: { $ne: id } });
    if (codeTaken) return { error: "This Customer Code is already assigned to another account." };
  }

  const before = customer.toObject();

  customer.name = parsed.data.name ?? customer.name;
  customer.email = parsed.data.email ? parsed.data.email.toLowerCase() : customer.email;
  customer.phone = parsed.data.phone ?? customer.phone;
  customer.address = parsed.data.address ?? customer.address;
  customer.company = parsed.data.company ?? customer.company;
  customer.accountType = (parsed.data.accountType as typeof customer.accountType) ?? customer.accountType;
  customer.contactPerson = parsed.data.contactPerson ?? customer.contactPerson;
  customer.nidTradeLicense = parsed.data.nidTradeLicense ?? customer.nidTradeLicense;
  if (parsed.data.customerCode) customer.customerCode = parsed.data.customerCode;
  customer.cardName = parsed.data.cardName ?? customer.cardName;
  customer.iccid = parsed.data.iccid ?? customer.iccid;
  customer.imei = parsed.data.imei ?? customer.imei;
  customer.service = parsed.data.service ?? customer.service;
  customer.vendor = parsed.data.vendor ?? customer.vendor;
  if (parsed.data.network) customer.network = parsed.data.network;

  // Suspending/reactivating via the status pills never resurrects an
  // INVITED account into ACTIVE (that only happens via set-password).
  if (parsed.data.status && parsed.data.status !== "INVITED" && customer.status !== "INVITED") {
    customer.status = parsed.data.status;
  } else if (parsed.data.status === "SUSPENDED") {
    customer.status = "SUSPENDED";
  }

  await customer.save();

  // ----- Subscription / plan change -----
  if (parsed.data.planId) {
    const activeSub = await Subscription.findOne({ customer: customer._id, status: "ACTIVE" }).sort({
      createdAt: -1,
    });
    if (activeSub && activeSub.plan.toString() !== parsed.data.planId) {
      await ActivityLog.create({
        actor: admin.id,
        targetCustomer: customer._id,
        action: "PLAN_CHANGED",
        meta: { from: activeSub.plan.toString(), to: parsed.data.planId },
      });
      activeSub.plan = parsed.data.planId as unknown as typeof activeSub.plan;
      if (parsed.data.staticIp) activeSub.staticIp = parsed.data.staticIp;
      await activeSub.save();
    } else if (!activeSub) {
      await Subscription.create({
        customer: customer._id,
        plan: parsed.data.planId,
        status: "ACTIVE",
        staticIp: parsed.data.staticIp,
        terminalIds: customer.iccid ? [customer.iccid] : [],
      });
    }
  }

  // ----- Usage this period (manual override) -----
  const hasUsageInput = [
    "volumeDataBytesGb",
    "volumeMin",
    "volumeMsg",
    "volumeInBundleBytesGb",
    "volumeOutBundleBytesGb",
    "volumeTotalBytesGb",
    "consumptionMoney",
    "consumptionDataBytesGb",
    "consumptionMin",
    "consumptionMsg",
  ].some((k) => formData.get(k) !== null && formData.get(k) !== "");

  if (hasUsageInput) {
    const periodMonth = currentPeriodMonth();
    const existingUsage = await UsageRecord.findOne({ customer: customer._id, periodMonth });
    const beforeUsage = existingUsage ? existingUsage.toObject() : null;

    const gb = (key: string) => {
      const v = numOrUndefined(formData, key);
      return v === undefined ? undefined : Math.round(v * GB);
    };

    const update: Record<string, unknown> = { lastUpdatedBy: admin.id };
    const volumeDataBytes = gb("volumeDataBytesGb");
    const volumeMin = numOrUndefined(formData, "volumeMin");
    const volumeMsg = numOrUndefined(formData, "volumeMsg");
    const volumeInBundleBytes = gb("volumeInBundleBytesGb");
    const volumeOutBundleBytes = gb("volumeOutBundleBytesGb");
    const volumeTotalBytes = gb("volumeTotalBytesGb");
    const consumptionMoney = numOrUndefined(formData, "consumptionMoney");
    const consumptionDataBytes = gb("consumptionDataBytesGb");
    const consumptionMin = numOrUndefined(formData, "consumptionMin");
    const consumptionMsg = numOrUndefined(formData, "consumptionMsg");

    if (volumeDataBytes !== undefined) update.volumeDataBytes = volumeDataBytes;
    if (volumeMin !== undefined) update.volumeMin = volumeMin;
    if (volumeMsg !== undefined) update.volumeMsg = volumeMsg;
    if (volumeInBundleBytes !== undefined) update.volumeInBundleBytes = volumeInBundleBytes;
    if (volumeOutBundleBytes !== undefined) update.volumeOutBundleBytes = volumeOutBundleBytes;
    if (volumeTotalBytes !== undefined) update.volumeTotalBytes = volumeTotalBytes;
    if (consumptionMoney !== undefined) update.consumptionMoney = consumptionMoney;
    if (consumptionDataBytes !== undefined) update.consumptionDataBytes = consumptionDataBytes;
    if (consumptionMin !== undefined) update.consumptionMin = consumptionMin;
    if (consumptionMsg !== undefined) update.consumptionMsg = consumptionMsg;

    update.source = beforeUsage?.source === "CDR" || beforeUsage?.source === "CDR+MANUAL" ? "CDR+MANUAL" : "MANUAL";

    const updatedUsage = await UsageRecord.findOneAndUpdate(
      { customer: customer._id, periodMonth },
      { $set: update, $setOnInsert: { customer: customer._id, periodMonth } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await ActivityLog.create({
      actor: admin.id,
      targetCustomer: customer._id,
      action: "USAGE_MANUAL_UPDATE",
      meta: { periodMonth, before: beforeUsage, after: updatedUsage.toObject() },
    });
  }

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "CUSTOMER_UPDATED",
    meta: { before: { name: before.name, email: before.email, status: before.status } },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return { success: "Customer updated." };
}

export async function deleteCustomerAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can delete customers." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };

  await Subscription.deleteMany({ customer: customer._id });
  await User.deleteOne({ _id: customer._id });

  await ActivityLog.create({
    actor: admin.id,
    action: "CUSTOMER_DELETED",
    meta: { customerId: customer.customerId, email: customer.email, name: customer.name },
  });

  revalidatePath("/admin/customers");
  return { success: "Customer deleted." };
}

export async function suspendCustomerAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };

  customer.status = "SUSPENDED";
  await customer.save();

  await ActivityLog.create({ actor: admin.id, targetCustomer: customer._id, action: "CUSTOMER_SUSPENDED" });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { success: "Customer suspended." };
}

export async function reactivateCustomerAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };

  customer.status = "ACTIVE";
  await customer.save();

  await ActivityLog.create({ actor: admin.id, targetCustomer: customer._id, action: "CUSTOMER_REACTIVATED" });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { success: "Customer reactivated." };
}

export async function resendInviteAction(customerId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const customer = await User.findOne({ _id: customerId, role: "CUSTOMER" });
  if (!customer) return { error: "Customer not found." };
  if (customer.status === "ACTIVE") return { error: "This customer has already activated their account." };

  await issueInvite(customer);
  await ActivityLog.create({ actor: admin.id, targetCustomer: customer._id, action: "INVITE_RESENT" });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { success: `Invitation resent to ${customer.email}.` };
}

export async function updateManualUsageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const raw = {
    customerId: str(formData, "customerId"),
    periodMonth: str(formData, "periodMonth"),
    volumeDataBytes: numOrUndefined(formData, "volumeDataBytesGb") !== undefined
      ? Math.round((numOrUndefined(formData, "volumeDataBytesGb") ?? 0) * GB)
      : undefined,
    volumeMin: numOrUndefined(formData, "volumeMin"),
    volumeMsg: numOrUndefined(formData, "volumeMsg"),
    volumeInBundleBytes: numOrUndefined(formData, "volumeInBundleBytesGb") !== undefined
      ? Math.round((numOrUndefined(formData, "volumeInBundleBytesGb") ?? 0) * GB)
      : undefined,
    volumeOutBundleBytes: numOrUndefined(formData, "volumeOutBundleBytesGb") !== undefined
      ? Math.round((numOrUndefined(formData, "volumeOutBundleBytesGb") ?? 0) * GB)
      : undefined,
    volumeTotalBytes: numOrUndefined(formData, "volumeTotalBytesGb") !== undefined
      ? Math.round((numOrUndefined(formData, "volumeTotalBytesGb") ?? 0) * GB)
      : undefined,
    consumptionMoney: numOrUndefined(formData, "consumptionMoney"),
    consumptionDataBytes: numOrUndefined(formData, "consumptionDataBytesGb") !== undefined
      ? Math.round((numOrUndefined(formData, "consumptionDataBytesGb") ?? 0) * GB)
      : undefined,
    consumptionMin: numOrUndefined(formData, "consumptionMin"),
    consumptionMsg: numOrUndefined(formData, "consumptionMsg"),
  };

  const parsed = manualUsageSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the values and try again." };
  }

  await connectDB();
  const { customerId, periodMonth, ...fields } = parsed.data;

  const existing = await UsageRecord.findOne({ customer: customerId, periodMonth });
  const before = existing ? existing.toObject() : null;

  const update: Record<string, unknown> = { lastUpdatedBy: admin.id };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) update[k] = v;
  }
  update.source = before?.source === "CDR" || before?.source === "CDR+MANUAL" ? "CDR+MANUAL" : "MANUAL";

  const after = await UsageRecord.findOneAndUpdate(
    { customer: customerId, periodMonth },
    { $set: update, $setOnInsert: { customer: customerId, periodMonth } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customerId,
    action: "USAGE_MANUAL_UPDATE",
    meta: { periodMonth, before, after: after.toObject() },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  return { success: `Usage for ${periodMonth} updated.` };
}
