import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const CDR_IMPORT_STATUSES = ["PROCESSING", "COMPLETED", "FAILED"] as const;
export type CdrImportStatus = (typeof CDR_IMPORT_STATUSES)[number];

const CdrImportBatchSchema = new Schema(
  {
    fileName: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Hash of the raw file content, used to warn on likely re-uploads of the same file.
    fileHash: { type: String, default: "", index: true },

    // Which raw CSV columns were used as the identifier / wholesale-charge
    // source for this import — kept for traceability since column names can
    // vary between exports and may be auto-detected or admin-overridden.
    identifierColumn: { type: String, default: "" },
    wholesaleColumn: { type: String, default: "" },

    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    matchedRows: { type: Number, default: 0 },
    unmatchedRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },

    totalWholesaleAmount: { type: Number, default: 0 },
    totalRetailAmount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },

    status: { type: String, enum: CDR_IMPORT_STATUSES, default: "PROCESSING" },
    errorLog: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type CdrImportBatchDoc = InferSchemaType<typeof CdrImportBatchSchema>;

export const CdrImportBatch: Model<CdrImportBatchDoc> =
  (mongoose.models.CdrImportBatch as Model<CdrImportBatchDoc>) ||
  mongoose.model<CdrImportBatchDoc>("CdrImportBatch", CdrImportBatchSchema);
