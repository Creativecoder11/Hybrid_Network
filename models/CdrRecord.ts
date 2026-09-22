import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { UNALLOCATED_REASON_CODES } from "./cdrAllocation";

export const CDR_ALLOCATION_STATUSES = ["ALLOCATED", "UNALLOCATED", "DUPLICATE"] as const;
export type CdrAllocationStatus = (typeof CDR_ALLOCATION_STATUSES)[number];

const CdrRecordSchema = new Schema(
  {
    cdrBatch: { type: Schema.Types.ObjectId, ref: "CdrBatch", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    customerAccount: { type: Schema.Types.ObjectId, ref: "CustomerAccount", default: null, index: true },
    product: { type: Schema.Types.ObjectId, ref: "CdrIdentifierMapping", default: null },

    // ALLOCATED rows feed UsageRecord; UNALLOCATED rows wait in the report for
    // an admin to add the missing Customer Account / Product Code and
    // reprocess. `matched` below mirrors ALLOCATED for older screens.
    allocationStatus: { type: String, enum: CDR_ALLOCATION_STATUSES, default: "UNALLOCATED", index: true },
    unallocatedReasonCode: { type: String, enum: [...UNALLOCATED_REASON_CODES, null], default: null },
    unallocatedReason: { type: String, default: "" },
    dedupeKey: { type: String, default: "", index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

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
CdrRecordSchema.index({ customerAccount: 1, period: 1 });
CdrRecordSchema.index({ cdrBatch: 1, allocationStatus: 1 });

export type CdrRecordDoc = InferSchemaType<typeof CdrRecordSchema>;

export const CdrRecord: Model<CdrRecordDoc> =
  (mongoose.models.CdrRecord as Model<CdrRecordDoc>) ||
  mongoose.model<CdrRecordDoc>("CdrRecord", CdrRecordSchema);
