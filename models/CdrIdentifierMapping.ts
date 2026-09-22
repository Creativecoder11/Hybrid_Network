import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PRODUCT_TYPES } from "./cdrAllocation";

// The Product Code catalogue. Every CDR row carries a product code (the
// "identifier" — e.g. the Rated CDR's "Prod" column, or the retail CSV's
// Product Code column); a row is only allocated when its code resolves to an
// ACTIVE entry here. `retailPlan` is the pricing rule the retail import uses
// to turn the wholesale charge into a customer charge; it is optional so a
// product can exist for usage allocation before pricing is set up.
//
// (Collection/model name kept as CdrIdentifierMapping so existing mappings and
// the CDR charge records that reference them keep working unchanged.)
const CdrIdentifierMappingSchema = new Schema(
  {
    identifier: { type: String, required: true, trim: true },
    name: { type: String, default: "", trim: true },
    productType: { type: String, enum: PRODUCT_TYPES, default: "OTHER" },
    category: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    retailPlan: { type: Schema.Types.ObjectId, ref: "RetailPlan", default: null, index: true },
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
