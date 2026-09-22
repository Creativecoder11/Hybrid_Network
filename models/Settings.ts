import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "GLOBAL" },
    // Trading name shown in the portal; legal name + ABN are what a tax
    // invoice must carry.
    companyName: { type: String, default: "Hybrid Networks" },
    companyLegalName: { type: String, default: "Hybrid Networks Pty Ltd" },
    companyAbn: { type: String, default: "" },
    companyAddress: { type: String, default: "" },
    companyEmail: { type: String, default: "" },
    companyPhone: { type: String, default: "" },
    companyWebsite: { type: String, default: "" },
    // Free text printed on invoices and shown in the portal's Pay Now dialog
    // (e.g. bank name, BSB, account number, BPAY biller code).
    paymentInstructions: { type: String, default: "" },
    currency: { type: String, default: "USD" },
    taxLabel: { type: String, default: "GST" },
    taxRate: { type: Number, default: 6 },
    invoicePrefix: { type: String, default: "HINV" },
    invoiceNextNumber: { type: Number, default: 1001 },
    timezone: { type: String, default: "Asia/Dhaka" },

    // Super Admin feature controls, enforced server-side for every customer
    // (lib/portal/features.ts). Customers cannot change these.
    featureDeviceLocation: { type: Boolean, default: true },
    featureTracking: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const Settings: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ||
  mongoose.model<SettingsDoc>("Settings", SettingsSchema);
