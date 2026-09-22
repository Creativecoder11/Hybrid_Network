import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const CUSTOMER_ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
export type CustomerAccountStatus = (typeof CUSTOMER_ACCOUNT_STATUSES)[number];

/** Normalized form of an account number used for uniqueness and CDR matching. */
export function normalizeAccountNumber(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

// A Customer Profile (a User with role CUSTOMER and no customerProfile link)
// owns one or more Customer Accounts. The account number IS the "Customer
// Code" that appears on CDR rows — it is what CDR allocation matches on.
// Devices (SLASH vessels), plans, usage, bills and CDR records are all scoped
// to an account, so a single login can see several accounts without their
// data mixing.
const CustomerAccountSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    accountNumber: { type: String, required: true, trim: true },
    accountNumberNormalized: { type: String, required: true, unique: true },
    name: { type: String, default: "", trim: true },
    status: { type: String, enum: CUSTOMER_ACCOUNT_STATUSES, default: "ACTIVE", index: true },

    // SLASH / Starlink linkage. A vessel is SLASH's container for one service
    // line and its user terminals; an account may hold several.
    starlinkVesselIds: { type: [String], default: [], index: true },
    // Starlink account number (e.g. "ACC-1234567-12345-12"), required by the
    // SLASH WRITE passthrough actions that take an account_number path param.
    slashAccountNumber: { type: String, default: "", trim: true },

    // Secondary CDR identifiers, used only when a CDR row carries no customer
    // code at all (legacy ICCID / card-name keyed exports).
    iccids: { type: [String], default: [], index: true },
    cardName: { type: String, default: "", trim: true },

    // Optional restriction: when non-empty, only these product codes may be
    // allocated to this account. Anything else becomes an Unallocated record.
    allowedProductCodes: { type: [String], default: [] },

    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

CustomerAccountSchema.index({ customer: 1, status: 1 });

CustomerAccountSchema.pre("validate", function () {
  this.accountNumberNormalized = normalizeAccountNumber(this.accountNumber);
});

export type CustomerAccountDoc = InferSchemaType<typeof CustomerAccountSchema>;

export const CustomerAccount: Model<CustomerAccountDoc> =
  (mongoose.models.CustomerAccount as Model<CustomerAccountDoc>) ||
  mongoose.model<CustomerAccountDoc>("CustomerAccount", CustomerAccountSchema);
