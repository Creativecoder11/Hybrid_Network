import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// A monthly invoice schedule for one Customer Account: the same fixed line
// items are invoiced once per calendar month for `durationMonths` months.
// Each run creates an ordinary DRAFT Invoice linked back here (Invoice.
// recurringInvoice + recurringSequence) for an admin to review and send.
// Generation lives in lib/billing/recurring.ts.

export const RECURRING_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

const RecurringLineItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: "" },
    unitPrice: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const RecurringInvoiceSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerAccount: { type: Schema.Types.ObjectId, ref: "CustomerAccount", required: true, index: true },
    accountNumber: { type: String, default: "" },
    lineItems: { type: [RecurringLineItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxLabel: { type: String, default: "GST" },
    currency: { type: String, default: "USD" },
    /** First issue date (UTC midnight). Later issues fall on the same day of month, clamped. */
    startDate: { type: Date, required: true },
    durationMonths: { type: Number, required: true, min: 1, max: 36 },
    /** Payment terms: due date = issue date + dueDays. */
    dueDays: { type: Number, default: 14, min: 0, max: 120 },
    /** How many invoices have been generated so far (also the next sequence number - 1). */
    invoicesGenerated: { type: Number, default: 0 },
    /** Issue date of the next invoice to generate; null once completed or cancelled. */
    nextInvoiceDate: { type: Date, default: null, index: true },
    status: { type: String, enum: RECURRING_STATUSES, default: "ACTIVE", index: true },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export type RecurringInvoiceDoc = InferSchemaType<typeof RecurringInvoiceSchema>;

export const RecurringInvoice: Model<RecurringInvoiceDoc> =
  (mongoose.models.RecurringInvoice as Model<RecurringInvoiceDoc>) ||
  mongoose.model<RecurringInvoiceDoc>("RecurringInvoice", RecurringInvoiceSchema);
