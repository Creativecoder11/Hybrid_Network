import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "GLOBAL" },
    companyName: { type: String, default: "Hybrid Networks" },
    companyAddress: { type: String, default: "" },
    companyEmail: { type: String, default: "" },
    companyPhone: { type: String, default: "" },
    currency: { type: String, default: "MYR" },
    taxLabel: { type: String, default: "GST" },
    taxRate: { type: Number, default: 6 },
    invoicePrefix: { type: String, default: "HINV" },
    invoiceNextNumber: { type: Number, default: 1001 },
    timezone: { type: String, default: "Asia/Dhaka" },
  },
  { timestamps: true }
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const Settings: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ||
  mongoose.model<SettingsDoc>("Settings", SettingsSchema);
