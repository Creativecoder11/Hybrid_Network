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
    customerCodeColumn: { type: String, default: "" },
    recordTypeColumn: { type: String, default: "" },
    dateColumn: { type: String, default: "" },

    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    // matchedRows = allocated, unmatchedRows = unallocated (names kept for
    // compatibility with existing batches).
    matchedRows: { type: Number, default: 0 },
    unmatchedRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    // Number of distinct customer codes seen — 1 for a single-customer file,
    // more for a bulk (multi-customer) file.
    distinctCustomerCodes: { type: Number, default: 0 },

    totalWholesaleAmount: { type: Number, default: 0 },
    totalRetailAmount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },

    status: { type: String, enum: CDR_IMPORT_STATUSES, default: "PROCESSING" },
    errorLog: { type: [String], default: [] },
    processingMs: { type: Number, default: 0 },

    // Unallocated-records alert (admin bell + dashboard) until acknowledged.
    alertAcknowledgedAt: { type: Date, default: null },
    alertAcknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

CdrImportBatchSchema.index({ createdAt: -1 });

export type CdrImportBatchDoc = InferSchemaType<typeof CdrImportBatchSchema>;

export const CdrImportBatch: Model<CdrImportBatchDoc> =
  (mongoose.models.CdrImportBatch as Model<CdrImportBatchDoc>) ||
  mongoose.model<CdrImportBatchDoc>("CdrImportBatch", CdrImportBatchSchema);
