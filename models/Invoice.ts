import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "DUE",
  "OVERDUE",
  "PAID",
  "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const LineItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: "" },
    unitPrice: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    periodMonth: { type: String, required: true },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },

    lineItems: { type: [LineItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxLabel: { type: String, default: "GST" },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },

    status: { type: String, enum: INVOICE_STATUSES, default: "DRAFT" },
    paidDate: { type: Date, default: null },
    paymentMethod: { type: String, default: "" },
    sentAt: { type: Date, default: null },
    pdfGeneratedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

InvoiceSchema.index({ customer: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1 });

export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema>;

export const Invoice: Model<InvoiceDoc> =
  (mongoose.models.Invoice as Model<InvoiceDoc>) ||
  mongoose.model<InvoiceDoc>("Invoice", InvoiceSchema);
