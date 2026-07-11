import { z } from "zod";

export const settingsSchema = z.object({
  companyName: z.string().min(1),
  companyAddress: z.string().optional().default(""),
  companyEmail: z.email().optional().or(z.literal("")),
  companyPhone: z.string().optional().default(""),
  currency: z.string().min(1),
  taxLabel: z.string().min(1),
  taxRate: z.coerce.number().min(0).max(100),
  invoicePrefix: z.string().min(1),
  timezone: z.string().min(1),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
