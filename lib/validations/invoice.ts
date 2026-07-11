import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().optional().default(""),
  unitPrice: z.coerce.number().min(0).default(0),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  subscriptionId: z.string().optional().nullable(),
  periodMonth: z.string().regex(/^\d{6}$/, "Format must be YYYYMM"),
  dueDate: z.string().min(1),
  amount: z.coerce.number().min(0).optional(),
  status: z.enum(["DRAFT", "SENT", "DUE", "OVERDUE", "PAID", "CANCELLED"]).optional(),
  extraLineItems: z.array(lineItemSchema).optional().default([]),
  taxRate: z.coerce.number().min(0).max(100).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const markPaidSchema = z.object({
  invoiceId: z.string().min(1),
  paymentMethod: z.string().min(1, "Payment method is required"),
  paidDate: z.string().min(1),
});
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
