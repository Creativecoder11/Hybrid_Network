import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PRICING_METHODS } from "./RetailPlan";
import { PRODUCT_TYPES, UNALLOCATED_REASON_CODES } from "./cdrAllocation";

// MATCHED = allocated (Customer Account + Product Code both valid).
// UNMATCHED = Unallocated — kept for the report and manual resolution.
// INVALID = the row itself could not be read (missing amount, etc.).
// DUPLICATE = the same CDR record was already processed in an earlier upload.
export const CDR_CHARGE_STATUSES = ["MATCHED", "UNMATCHED", "INVALID", "DUPLICATE"] as const;
export type CdrChargeStatus = (typeof CDR_CHARGE_STATUSES)[number];

const CdrChargeRecordSchema = new Schema(
  {
    importBatch: { type: Schema.Types.ObjectId, ref: "CdrImportBatch", required: true, index: true },
    rowNumber: { type: Number, default: 0 },

    // The Product Code as it appears on the CDR row.
    identifier: { type: String, default: "", index: true },
    description: { type: String, default: "" }, // Service/product label from the CDR row, for invoice display
    // Per-transaction id from the source file (e.g. "Cdr ID"), when the file has one — used to detect duplicates.
    sourceRecordId: { type: String, default: "", index: true },
    // Duplicate-protection key: "id:<sourceRecordId>" when the file carries a
    // record id, otherwise a hash of the row's content plus its occurrence
    // number within the file (see lib/cdr/dedupe.ts).
    dedupeKey: { type: String, default: "" },
    // true for rows that "own" their dedupeKey (allocated or unallocated);
    // the partial unique index below only applies to these.
    dedupeActive: { type: Boolean, default: false },

    recordType: { type: String, default: "" }, // e.g. CALL / SMS / DATA as written on the row
    eventAt: { type: Date, default: null },

    customer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    customerAccount: { type: Schema.Types.ObjectId, ref: "CustomerAccount", default: null, index: true },
    customerCode: { type: String, default: "", index: true },

    product: { type: Schema.Types.ObjectId, ref: "CdrIdentifierMapping", default: null },
    productName: { type: String, default: "" },
    productType: { type: String, enum: [...PRODUCT_TYPES, null], default: null },

    wholesaleAmount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },

    // Snapshotted at processing time so historical charges stay correct even
    // if the Retail Plan is edited or the mapping is later reassigned.
    retailPlan: { type: Schema.Types.ObjectId, ref: "RetailPlan", default: null },
    retailPlanName: { type: String, default: "" },
    pricingMethodUsed: { type: String, enum: [...PRICING_METHODS, null], default: null },
    markupPercentUsed: { type: Number, default: null },
    fixedPriceUsed: { type: Number, default: null },
    retailAmount: { type: Number, default: 0 },

    status: { type: String, enum: CDR_CHARGE_STATUSES, required: true, index: true },
    unallocatedReasonCode: { type: String, enum: [...UNALLOCATED_REASON_CODES, null], default: null },
    errorReason: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // Full original row, for audit/traceability of how the charge was derived.
    rawRow: { type: Schema.Types.Mixed, default: {} },

    invoice: { type: Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
  },
  { timestamps: true }
);

CdrChargeRecordSchema.index({ importBatch: 1, status: 1 });
CdrChargeRecordSchema.index({ customer: 1, invoice: 1 });
CdrChargeRecordSchema.index({ customerAccount: 1, status: 1, invoice: 1 });
CdrChargeRecordSchema.index({ status: 1, unallocatedReasonCode: 1 });
CdrChargeRecordSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeActive: true }, name: "dedupe_active_unique" }
);

export type CdrChargeRecordDoc = InferSchemaType<typeof CdrChargeRecordSchema>;

export const CdrChargeRecord: Model<CdrChargeRecordDoc> =
  (mongoose.models.CdrChargeRecord as Model<CdrChargeRecordDoc>) ||
  mongoose.model<CdrChargeRecordDoc>("CdrChargeRecord", CdrChargeRecordSchema);
