import { z } from "zod";

export const settingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  companyLegalName: z.string().trim().min(1, "Legal entity name is required"),
  // Australian Business Number: 11 digits (spaces allowed). Optional so the
  // form can be saved before it is known; invoices flag it when missing.
  companyAbn: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{11}$/.test(v.replace(/\s+/g, "")), "ABN must be 11 digits")
    .optional()
    .default(""),
  companyAddress: z.string().optional().default(""),
  companyEmail: z.email().optional().or(z.literal("")),
  companyPhone: z.string().optional().default(""),
  companyWebsite: z.string().trim().max(200).optional().default(""),
  paymentInstructions: z.string().max(2000).optional().default(""),
  currency: z.string().min(1),
  taxLabel: z.string().min(1),
  taxRate: z.coerce.number().min(0).max(100),
  invoicePrefix: z.string().min(1),
  timezone: z.string().min(1),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
