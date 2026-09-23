import { z } from "zod";
import { ACCOUNT_TYPES } from "@/models/User";
import { accountNumberField } from "@/lib/validations/account";

export const networkInfoSchema = z.object({
  originNumber: z.string().optional().default(""),
  originCountry: z.string().optional().default(""),
  originIpAddress: z.string().optional().default(""),
  originRegion: z.string().optional().default(""),
  originState: z.string().optional().default(""),
  destinationNumber: z.string().optional().default(""),
  destinationNetwork: z.string().optional().default(""),
  destinationCountry: z.string().optional().default(""),
  destinationState: z.string().optional().default(""),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Full name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().min(1, "Phone number is required"),
  address: z.string().optional().default(""),
  company: z.string().optional().default(""),

  accountType: z.enum(ACCOUNT_TYPES, {
    message: "Account type is required",
  }),
  contactPerson: z.string().optional().default(""),
  nidTradeLicense: z.string().trim().min(1, "NID / Trade License is required"),
  // Customer Account numbers (required, at least 1).
  accountNumbers: z
    .array(accountNumberField)
    .min(1, "At least one Customer Account number is required")
    .max(20),
  cardName: z.string().optional().default(""),
  iccid: z.string().optional().default(""),
  imei: z.string().optional().default(""),
  service: z.string().optional().default(""),
  vendor: z.string().optional().default(""),
  starlinkVesselId: z.string().trim().min(1, "Starlink Vessel ID is required"),
  starlinkServiceLineNumber: z.string().optional().default(""),

  network: networkInfoSchema.optional(),

  planId: z.string().trim().min(1, "Service plan is required"),
  staticIp: z.string().optional().default(""),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "INVITED"]).optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const manualUsageSchema = z.object({
  customerId: z.string().min(1),
  customerAccountId: z.string().regex(/^[a-f0-9]{24}$/i, "Choose a Customer Account"),
  periodMonth: z.string().regex(/^\d{6}$/, "Format must be YYYYMM"),
  volumeDataBytes: z.coerce.number().min(0).optional(),
  volumeMin: z.coerce.number().min(0).optional(),
  volumeMsg: z.coerce.number().min(0).optional(),
  volumeInBundleBytes: z.coerce.number().min(0).optional(),
  volumeOutBundleBytes: z.coerce.number().min(0).optional(),
  volumeTotalBytes: z.coerce.number().min(0).optional(),
  consumptionMoney: z.coerce.number().min(0).optional(),
  consumptionDataBytes: z.coerce.number().min(0).optional(),
  consumptionMin: z.coerce.number().min(0).optional(),
  consumptionMsg: z.coerce.number().min(0).optional(),
});
export type ManualUsageInput = z.infer<typeof manualUsageSchema>;
