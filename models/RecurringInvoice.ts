import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const RECURRING_INVOICE_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
export type RecurringInvoiceStatus = (typeof RECURRING_INVOICE_STATUSES)[number];

export const RECURRING_TERM_MIN_MONTHS = 1;
export const RECURRING_TERM_MAX_MONTHS = 36;

// A schedule that bills one Customer Account a fixed amount every month for a
// fixed term (1–36 months). lib/billing/recurring.ts turns each due cycle into
// an ordinary Invoice, so recurring bills show up everywhere a manual bill does.
const RecurringInvoiceSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerAccount: { type: Schema.Types.ObjectId, ref: "CustomerAccount", required: true, index: true },
    accountNumber: { type: String, default: "" },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },

    description: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },

    termMonths: { type: Number, required: true, min: RECURRING_TERM_MIN_MONTHS, max: RECURRING_TERM_MAX_MONTHS },
    // Day of month invoices are issued on (clamped to the month's last day).
    billingDay: { type: Number, required: true, min: 1, max: 31 },
    // Days from issue date to due date.
    paymentTermsDays: { type: Number, default: 14 },
    // Email each invoice (PDF attached) as it's generated; otherwise it's left as a Draft.
    autoSend: { type: Boolean, default: true },

    startDate: { type: Date, required: true },
    // Cycle `anchorCycle` is issued in the month of `anchorDate`; later cycles
    // follow monthly. Resuming a paused schedule moves the anchor forward so
    // paused months are skipped, not back-billed.
    anchorDate: { type: Date, required: true },
    anchorCycle: { type: Number, default: 0 },

    cyclesGenerated: { type: Number, default: 0 },
    nextIssueDate: { type: Date, default: null },
    lastIssuedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },

    status: { type: String, enum: RECURRING_INVOICE_STATUSES, default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

RecurringInvoiceSchema.index({ status: 1, nextIssueDate: 1 });

export type RecurringInvoiceDoc = InferSchemaType<typeof RecurringInvoiceSchema>;

export const RecurringInvoice: Model<RecurringInvoiceDoc> =
  (mongoose.models.RecurringInvoice as Model<RecurringInvoiceDoc>) ||
  mongoose.model<RecurringInvoiceDoc>("RecurringInvoice", RecurringInvoiceSchema);
