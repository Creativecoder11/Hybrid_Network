import { z } from "zod";
import { RECURRING_TERM_MAX_MONTHS, RECURRING_TERM_MIN_MONTHS } from "@/models/RecurringInvoice";

export const createRecurringInvoiceSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  customerAccountId: z.string().min(1, "Choose a customer account"),
  description: z.string().trim().min(2, "Description is required").max(200),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  termMonths: z.coerce
    .number()
    .int()
    .min(RECURRING_TERM_MIN_MONTHS, `Term must be ${RECURRING_TERM_MIN_MONTHS}–${RECURRING_TERM_MAX_MONTHS} months`)
    .max(RECURRING_TERM_MAX_MONTHS, `Term must be ${RECURRING_TERM_MIN_MONTHS}–${RECURRING_TERM_MAX_MONTHS} months`),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the first invoice date"),
  paymentTermsDays: z.coerce.number().int().min(0).max(120).default(14),
  autoSend: z.boolean().default(true),
});
export type CreateRecurringInvoiceInput = z.infer<typeof createRecurringInvoiceSchema>;
