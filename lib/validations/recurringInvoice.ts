import { z } from "zod";
import { MAX_RECURRING_MONTHS, MIN_RECURRING_MONTHS, parseDateOnly } from "@/lib/billing/schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A start date further back than this would back-fill many invoices at once — almost always a typo. */
export const MAX_BACKDATE_DAYS = 31;

export const recurringLineItemSchema = z.object({
  description: z.string().trim().min(1, "Each line item needs a description"),
  quantity: z.number().positive("Quantity must be more than 0"),
  unit: z.string().trim().optional().default(""),
  unitPrice: z.number().min(0, "Unit price can't be negative"),
});

export const createRecurringInvoiceSchema = z.object({
  customerAccountId: z.string().regex(/^[a-f0-9]{24}$/i, "Choose a Customer Account"),
  startDate: z
    .string()
    .refine((v) => parseDateOnly(v) !== null, "Enter a valid start date")
    .refine((v) => {
      const d = parseDateOnly(v);
      return !d || d.getTime() >= Date.now() - MAX_BACKDATE_DAYS * DAY_MS;
    }, `The start date can't be more than ${MAX_BACKDATE_DAYS} days in the past`),
  durationMonths: z
    .number()
    .int("Duration must be a whole number of months")
    .min(MIN_RECURRING_MONTHS, `Duration must be ${MIN_RECURRING_MONTHS}–${MAX_RECURRING_MONTHS} months`)
    .max(MAX_RECURRING_MONTHS, `Duration must be ${MIN_RECURRING_MONTHS}–${MAX_RECURRING_MONTHS} months`),
  dueDays: z.number().int().min(0).max(120).optional().default(14),
  taxRate: z.number().min(0).max(100).optional(),
  lineItems: z.array(recurringLineItemSchema).min(1, "Add at least one line item"),
  notes: z.string().trim().max(500).optional().default(""),
});
