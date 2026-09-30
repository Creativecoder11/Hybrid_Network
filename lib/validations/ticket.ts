import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(3, "Subject is required"),
  message: z.string().min(5, "Please describe your issue"),
  category: z.enum(["BILLING", "TECHNICAL", "SERVICE", "GENERAL"]).optional().default("GENERAL"),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const replyTicketSchema = z.object({
  ticketId: z.string().min(1),
  message: z.string().min(1, "Reply cannot be empty"),
});
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;

export const updateTicketStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

export const assignTicketSchema = z.object({
  ticketId: z.string().min(1),
  assignedTo: z.string().optional().nullable(),
});
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
