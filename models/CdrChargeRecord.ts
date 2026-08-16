import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PRICING_METHODS } from "./RetailPlan";

export const CDR_CHARGE_STATUSES = ["MATCHED", "UNMATCHED", "INVALID"] as const;
export type CdrChargeStatus = (typeof CDR_CHARGE_STATUSES)[number];

const CdrChargeRecordSchema = new Schema(
  {
    importBatch: { type: Schema.Types.ObjectId, ref: "CdrImportBatch", required: true, index: true },
    rowNumber: { type: Number, default: 0 },

    identifier: { type: String, default: "", index: true },
    description: { type: String, default: "" }, // Service/product label from the CDR row, for invoice display
    // Per-transaction id from the source file (e.g. "Cdr ID"), when the file has one — used to detect duplicates.
    sourceRecordId: { type: String, default: "", index: true },

    customer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    customerCode: { type: String, default: "" },

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
    errorReason: { type: String, default: "" },

    // Full original row, for audit/traceability of how the charge was derived.
    rawRow: { type: Schema.Types.Mixed, default: {} },

    invoice: { type: Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
  },
  { timestamps: true }
);

CdrChargeRecordSchema.index({ importBatch: 1, status: 1 });
CdrChargeRecordSchema.index({ customer: 1, invoice: 1 });

export type CdrChargeRecordDoc = InferSchemaType<typeof CdrChargeRecordSchema>;

export const CdrChargeRecord: Model<CdrChargeRecordDoc> =
  (mongoose.models.CdrChargeRecord as Model<CdrChargeRecordDoc>) ||
  mongoose.model<CdrChargeRecordDoc>("CdrChargeRecord", CdrChargeRecordSchema);
