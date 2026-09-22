import { z } from "zod";
import { CUSTOMER_ACCOUNT_STATUSES } from "@/models/CustomerAccount";

/** Splits a comma / semicolon / newline separated list into unique trimmed values. */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(new Set(String(raw).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)));
}

// Account numbers are Customer Codes as they appear on CDR files: letters,
// digits and a few separators, no spaces.
export const accountNumberField = z
  .string()
  .trim()
  .min(1, "Account number is required")
  .max(64, "Account number is too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/, "Account number may only contain letters, numbers, . _ - /");

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

export const customerAccountSchema = z.object({
  id: objectId.optional(),
  customerId: objectId,
  accountNumber: accountNumberField,
  name: z.string().trim().max(120).optional().default(""),
  status: z.enum(CUSTOMER_ACCOUNT_STATUSES).default("ACTIVE"),
  starlinkVesselIds: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  slashAccountNumber: z.string().trim().max(64).optional().default(""),
  iccids: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
  cardName: z.string().trim().max(120).optional().default(""),
  allowedProductCodes: z.array(z.string().trim().min(1).max(64)).max(200).default([]),
  notes: z.string().max(2000).optional().default(""),
  planId: z.string().optional().nullable(),
  staticIp: z.string().trim().max(64).optional().default(""),
});
export type CustomerAccountInput = z.infer<typeof customerAccountSchema>;

export const portalUserSchema = z
  .object({
    profileId: objectId,
    name: z.string().trim().min(2, "Full name is required").max(120),
    email: z.email("Enter a valid email").transform((e) => e.toLowerCase().trim()),
    phone: z.string().trim().max(40).optional().default(""),
    accountAccessAll: z.boolean(),
    accountIds: z.array(objectId).default([]),
  })
  .refine((d) => d.accountAccessAll || d.accountIds.length > 0, {
    message: "Give the user access to at least one Customer Account (or all accounts).",
    path: ["accountIds"],
  });
export type PortalUserInput = z.infer<typeof portalUserSchema>;

export const accountAccessSchema = z
  .object({
    userId: objectId,
    accountAccessAll: z.boolean(),
    accountIds: z.array(objectId).default([]),
  })
  .refine((d) => d.accountAccessAll || d.accountIds.length > 0, {
    message: "Give the user access to at least one Customer Account (or all accounts).",
    path: ["accountIds"],
  });
