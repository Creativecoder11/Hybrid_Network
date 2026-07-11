import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "PAUSED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const SubscriptionSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: "ServicePlan", required: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, default: null },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "ACTIVE" },
    staticIp: { type: String, default: "" },
    terminalIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ customer: 1, status: 1 });

export type SubscriptionDoc = InferSchemaType<typeof SubscriptionSchema>;

export const Subscription: Model<SubscriptionDoc> =
  (mongoose.models.Subscription as Model<SubscriptionDoc>) ||
  mongoose.model<SubscriptionDoc>("Subscription", SubscriptionSchema);
