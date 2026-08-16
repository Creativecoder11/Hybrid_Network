import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CdrIdentifierMappingSchema = new Schema(
  {
    identifier: { type: String, required: true, trim: true },
    retailPlan: { type: Schema.Types.ObjectId, ref: "RetailPlan", required: true, index: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// An identifier may have historical/inactive mappings, but only one ACTIVE
// mapping at a time — this is what prevents ambiguous pricing (an identifier
// silently resolving to two different Retail Plans). Reassigning an
// identifier means deactivating the old mapping and creating a new one,
// which keeps already-processed CDR records' pricing snapshot intact.
CdrIdentifierMappingSchema.index(
  { identifier: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export type CdrIdentifierMappingDoc = InferSchemaType<typeof CdrIdentifierMappingSchema>;

export const CdrIdentifierMapping: Model<CdrIdentifierMappingDoc> =
  (mongoose.models.CdrIdentifierMapping as Model<CdrIdentifierMappingDoc>) ||
  mongoose.model<CdrIdentifierMappingDoc>("CdrIdentifierMapping", CdrIdentifierMappingSchema);
