import "server-only";
import type { Types } from "mongoose";
import type { CustomerRow } from "@/lib/types/admin";

const GB = 1_000_000_000;
const toGB = (bytes: number | null | undefined) => Math.round(((bytes ?? 0) / GB) * 100) / 100;

type ProfileLean = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  company?: string | null;
  customerId?: string | null;
  customerCode?: string | null;
  status: CustomerRow["status"];
  createdAt?: Date;
  accountType?: CustomerRow["accountType"];
  contactPerson?: string | null;
  nidTradeLicense?: string | null;
  cardName?: string | null;
  iccid?: string | null;
  imei?: string | null;
  service?: string | null;
  vendor?: string | null;
  starlinkVesselId?: string | null;
  starlinkServiceLineNumber?: string | null;
  network?: Partial<CustomerRow["network"]> | null;
};

type UsageLean = {
  volumeDataBytes?: number | null;
  volumeMin?: number | null;
  volumeMsg?: number | null;
  volumeInBundleBytes?: number | null;
  volumeOutBundleBytes?: number | null;
  volumeTotalBytes?: number | null;
  consumptionMoney?: number | null;
  consumptionDataBytes?: number | null;
  consumptionMin?: number | null;
  consumptionMsg?: number | null;
};

/** Maps a Customer Profile document to the admin CustomerRow shape. */
export function toCustomerRow(
  c: ProfileLean,
  extras: {
    accountNumbers: string[];
    plan?: { planId: string; planName: string; staticIp: string } | null;
    usage?: UsageLean | null;
    starlinkVesselId?: string | null;
  }
): CustomerRow {
  const usage = extras.usage;
  return {
    id: c._id.toString(),
    name: c.name,
    email: c.email,
    phone: c.phone ?? "",
    address: c.address ?? "",
    company: c.company ?? "",
    customerId: c.customerId ?? "",
    customerCode: extras.accountNumbers[0] ?? c.customerCode ?? "",
    accountNumbers: extras.accountNumbers,
    status: c.status,
    createdAt: c.createdAt?.toISOString() ?? "",
    accountType: c.accountType ?? null,
    contactPerson: c.contactPerson ?? "",
    nidTradeLicense: c.nidTradeLicense ?? "",
    cardName: c.cardName ?? "",
    iccid: c.iccid ?? "",
    imei: c.imei ?? "",
    service: c.service ?? "",
    vendor: c.vendor ?? "",
    starlinkVesselId: c.starlinkVesselId || extras.starlinkVesselId || "",
    starlinkServiceLineNumber: c.starlinkServiceLineNumber ?? "",
    network: {
      originNumber: c.network?.originNumber ?? "",
      originCountry: c.network?.originCountry ?? "",
      originIpAddress: c.network?.originIpAddress ?? "",
      originRegion: c.network?.originRegion ?? "",
      originState: c.network?.originState ?? "",
      destinationNumber: c.network?.destinationNumber ?? "",
      destinationNetwork: c.network?.destinationNetwork ?? "",
      destinationCountry: c.network?.destinationCountry ?? "",
      destinationState: c.network?.destinationState ?? "",
    },
    planId: extras.plan?.planId ?? "",
    planName: extras.plan?.planName ?? "",
    staticIp: extras.plan?.staticIp ?? "",
    usage: usage
      ? {
          volumeDataGB: toGB(usage.volumeDataBytes),
          volumeMin: usage.volumeMin ?? 0,
          volumeMsg: usage.volumeMsg ?? 0,
          volumeInBundleGB: toGB(usage.volumeInBundleBytes),
          volumeOutBundleGB: toGB(usage.volumeOutBundleBytes),
          volumeTotalGB: toGB(usage.volumeTotalBytes),
          consumptionMoney: usage.consumptionMoney ?? 0,
          consumptionDataGB: toGB(usage.consumptionDataBytes),
          consumptionMin: usage.consumptionMin ?? 0,
          consumptionMsg: usage.consumptionMsg ?? 0,
        }
      : null,
  };
}

/** Escapes user input for use inside a MongoDB $regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
