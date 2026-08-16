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

    // Populated only for line items generated from a priced CDR charge
    // record — preserved here (rather than just referenced) so the invoice
    // stays a correct audit trail even if the source Retail Plan changes later.
    cdrChargeRecord: { type: Schema.Types.ObjectId, ref: "CdrChargeRecord", default: null },
    cdrIdentifier: { type: String, default: "" },
    wholesaleAmount: { type: Number, default: null },
    retailPlanName: { type: String, default: "" },
    pricingMethod: { type: String, default: "" },
    markupPercent: { type: Number, default: null },
    fixedPrice: { type: Number, default: null },
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
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

InvoiceSchema.index({ customer: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1 });
InvoiceSchema.index({ deletedAt: 1 });

// Soft-delete safety net: every find/count/aggregate query on Invoice
// transparently excludes trashed invoices unless it explicitly filters on
// deletedAt itself (as the Trash view's queries do). This means callers
// elsewhere in the app don't each need to remember to exclude deleted rows.
// Mongoose 9's pre-hooks are plain return/promise based (no `next` callback).
function excludeDeletedQuery(this: mongoose.Query<unknown, unknown>) {
  const filter = this.getFilter();
  if (filter.deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
}

InvoiceSchema.pre("find", excludeDeletedQuery);
InvoiceSchema.pre("findOne", excludeDeletedQuery);
InvoiceSchema.pre("findOneAndUpdate", excludeDeletedQuery);
InvoiceSchema.pre("countDocuments", excludeDeletedQuery);

InvoiceSchema.pre("aggregate", function (this: mongoose.Aggregate<unknown>) {
  const pipeline = this.pipeline();
  const hasDeletedMatch = pipeline.some(
    (stage): stage is { $match: Record<string, unknown> } =>
      typeof stage === "object" && stage !== null && "$match" in stage &&
      Object.prototype.hasOwnProperty.call((stage as { $match: Record<string, unknown> }).$match, "deletedAt")
  );
  if (!hasDeletedMatch) {
    pipeline.unshift({ $match: { deletedAt: null } });
  }
});

export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema>;

export const Invoice: Model<InvoiceDoc> =
  (mongoose.models.Invoice as Model<InvoiceDoc>) ||
  mongoose.model<InvoiceDoc>("Invoice", InvoiceSchema);
