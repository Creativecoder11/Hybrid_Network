import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PLAN_PROVIDER_MAX_LENGTH } from "@/lib/plans/providers";

export { PLAN_PROVIDERS, PLAN_PROVIDER_MAX_LENGTH, type PlanProvider } from "@/lib/plans/providers";

export const PLAN_TYPES = ["DATA", "VOICE", "HYBRID"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

const ServicePlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true, maxlength: PLAN_PROVIDER_MAX_LENGTH },
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
