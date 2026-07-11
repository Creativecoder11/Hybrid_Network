import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const CDR_BATCH_STATUSES = ["PROCESSING", "COMPLETED", "FAILED"] as const;
export type CdrBatchStatus = (typeof CDR_BATCH_STATUSES)[number];

export const CDR_UPLOAD_MODES = ["REPLACE", "ACCUMULATE"] as const;
export type CdrUploadMode = (typeof CDR_UPLOAD_MODES)[number];

const CdrBatchSchema = new Schema(
  {
    fileName: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, default: "Starlink" },
    periodMonth: { type: String, default: "" },
    uploadMode: { type: String, enum: CDR_UPLOAD_MODES, default: "REPLACE" },
    totalRows: { type: Number, default: 0 },
    matchedRows: { type: Number, default: 0 },
    unmatchedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    status: { type: String, enum: CDR_BATCH_STATUSES, default: "PROCESSING" },
    errorLog: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type CdrBatchDoc = InferSchemaType<typeof CdrBatchSchema>;

export const CdrBatch: Model<CdrBatchDoc> =
  (mongoose.models.CdrBatch as Model<CdrBatchDoc>) ||
  mongoose.model<CdrBatchDoc>("CdrBatch", CdrBatchSchema);
