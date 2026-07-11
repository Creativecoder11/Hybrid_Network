import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const USAGE_SOURCES = ["CDR", "MANUAL", "CDR+MANUAL"] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

const UsageRecordSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null },
    periodMonth: { type: String, required: true }, // "YYYYMM"

    volumeDataBytes: { type: Number, default: 0 },
    volumeMin: { type: Number, default: 0 },
    volumeMsg: { type: Number, default: 0 },
    volumeInBundleBytes: { type: Number, default: 0 },
    volumeOutBundleBytes: { type: Number, default: 0 },
    volumeTotalBytes: { type: Number, default: 0 },

    consumptionMoney: { type: Number, default: 0 },
    consumptionDataBytes: { type: Number, default: 0 },
    consumptionMin: { type: Number, default: 0 },
    consumptionMsg: { type: Number, default: 0 },

    currency: { type: String, default: "USD" },
    cdrPriceTotal: { type: Number, default: 0 },
    cdrPriceInvoiced: { type: Number, default: 0 },

    source: { type: String, enum: USAGE_SOURCES, default: "CDR" },
    cdrBatch: { type: Schema.Types.ObjectId, ref: "CdrBatch", default: null },

    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

UsageRecordSchema.index({ customer: 1, periodMonth: 1 }, { unique: true });

export type UsageRecordDoc = InferSchemaType<typeof UsageRecordSchema>;

export const UsageRecord: Model<UsageRecordDoc> =
  (mongoose.models.UsageRecord as Model<UsageRecordDoc>) ||
  mongoose.model<UsageRecordDoc>("UsageRecord", UsageRecordSchema);
