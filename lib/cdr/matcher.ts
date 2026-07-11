import { User, type UserDoc } from "@/models/User";
import { connectDB } from "@/lib/db/connect";
import type { HydratedDocument } from "mongoose";

export type CustomerMatchMaps = {
  byCustomerCode: Map<string, HydratedDocument<UserDoc>>;
  byIccid: Map<string, HydratedDocument<UserDoc>>;
  byCardName: Map<string, HydratedDocument<UserDoc>>;
};

export async function buildCustomerMatchMaps(): Promise<CustomerMatchMaps> {
  await connectDB();
  const customers = await User.find({
    role: "CUSTOMER",
    $or: [
      { customerCode: { $ne: null } },
      { iccid: { $nin: [null, ""] } },
      { cardName: { $nin: [null, ""] } },
    ],
  });

  const byCustomerCode = new Map<string, HydratedDocument<UserDoc>>();
  const byIccid = new Map<string, HydratedDocument<UserDoc>>();
  const byCardName = new Map<string, HydratedDocument<UserDoc>>();

  for (const c of customers) {
    if (c.customerCode) byCustomerCode.set(c.customerCode.trim(), c);
    if (c.iccid) byIccid.set(c.iccid.trim(), c);
    if (c.cardName) byCardName.set(c.cardName.trim(), c);
  }

  return { byCustomerCode, byIccid, byCardName };
}

/** Priority order: Customer Code -> ICCID -> Card Name. */
export function matchCustomer(
  maps: CustomerMatchMaps,
  row: { customerCode: string; iccid: string; cardName: string }
): HydratedDocument<UserDoc> | null {
  if (row.customerCode && maps.byCustomerCode.has(row.customerCode)) {
    return maps.byCustomerCode.get(row.customerCode) ?? null;
  }
  if (row.iccid && maps.byIccid.has(row.iccid)) {
    return maps.byIccid.get(row.iccid) ?? null;
  }
  if (row.cardName && maps.byCardName.has(row.cardName)) {
    return maps.byCardName.get(row.cardName) ?? null;
  }
  return null;
}
