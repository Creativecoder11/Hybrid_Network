import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = ["BILLING", "TECHNICAL", "SERVICE", "GENERAL"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

const ReplySchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: TICKET_STATUSES, default: "OPEN" },
    category: { type: String, enum: TICKET_CATEGORIES, default: "GENERAL" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    replies: { type: [ReplySchema], default: [] },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ status: 1 });
SupportTicketSchema.index({ assignedTo: 1 });

export type SupportTicketDoc = InferSchemaType<typeof SupportTicketSchema>;

export const SupportTicket: Model<SupportTicketDoc> =
  (mongoose.models.SupportTicket as Model<SupportTicketDoc>) ||
  mongoose.model<SupportTicketDoc>("SupportTicket", SupportTicketSchema);
