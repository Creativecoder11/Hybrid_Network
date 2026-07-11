import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const PLAN_PROVIDERS = ["Starlink", "Fiber", "VSAT", "Other"] as const;
export type PlanProvider = (typeof PLAN_PROVIDERS)[number];

export const PLAN_TYPES = ["DATA", "VOICE", "HYBRID"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

const ServicePlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, enum: PLAN_PROVIDERS, required: true },
    planType: { type: String, enum: PLAN_TYPES, default: "DATA" },
    monthlyPrice: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "USD" },
    dataAllowanceGB: { type: Number, default: null },
    voiceMinutes: { type: Number, default: null },
    smsCount: { type: Number, default: null },
    overageRatePerGB: { type: Number, default: 0 },
    overageRatePerMin: { type: Number, default: 0 },
    speedMbps: { type: Number, default: null },
    sharedRatio: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type ServicePlanDoc = InferSchemaType<typeof ServicePlanSchema>;

export const ServicePlan: Model<ServicePlanDoc> =
  (mongoose.models.ServicePlan as Model<ServicePlanDoc>) ||
  mongoose.model<ServicePlanDoc>("ServicePlan", ServicePlanSchema);
