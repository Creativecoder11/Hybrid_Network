import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const PRICING_METHODS = ["PERCENTAGE_MARKUP", "FIXED_PRICE"] as const;
export type PricingMethod = (typeof PRICING_METHODS)[number];

const RetailPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    pricingMethod: { type: String, enum: PRICING_METHODS, required: true, default: "PERCENTAGE_MARKUP" },
    // Client-confirmed default markup is 50%.
    markupPercent: { type: Number, default: 50 },
    fixedPrice: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export type RetailPlanDoc = InferSchemaType<typeof RetailPlanSchema>;

export const RetailPlan: Model<RetailPlanDoc> =
  (mongoose.models.RetailPlan as Model<RetailPlanDoc>) ||
  mongoose.model<RetailPlanDoc>("RetailPlan", RetailPlanSchema);
