import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CdrRecordSchema = new Schema(
  {
    cdrBatch: { type: Schema.Types.ObjectId, ref: "CdrBatch", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    cdrId: { type: String, default: "" },
    prod: { type: String, default: "" },
    startCdr: { type: Date, default: null },

    customerCode: { type: String, default: "" },
    iccid: { type: String, default: "" },
    imei: { type: String, default: "" },
    service: { type: String, default: "" },
    cardName: { type: String, default: "" },
    vendor: { type: String, default: "" },

    destinationNumber: { type: String, default: "" },
    destinationNetwork: { type: String, default: "" },
    destinationCountry: { type: String, default: "" },
    destinationState: { type: String, default: "" },

    originNumber: { type: String, default: "" },
    originCountry: { type: String, default: "" },
    originIpAddress: { type: String, default: "" },
    originRegion: { type: String, default: "" },
    originState: { type: String, default: "" },

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

    priceCurrency: { type: String, default: "USD" },
    priceTotal: { type: Number, default: 0 },
    priceInBundle: { type: Number, default: 0 },
    priceInvoiced: { type: Number, default: 0 },

    period: { type: String, required: true, index: true },
    isFinal: { type: Boolean, default: true },
    matched: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CdrRecordSchema.index({ cdrBatch: 1, cdrId: 1 }, { unique: true });
CdrRecordSchema.index({ customer: 1, period: 1 });

export type CdrRecordDoc = InferSchemaType<typeof CdrRecordSchema>;

export const CdrRecord: Model<CdrRecordDoc> =
  (mongoose.models.CdrRecord as Model<CdrRecordDoc>) ||
  mongoose.model<CdrRecordDoc>("CdrRecord", CdrRecordSchema);
