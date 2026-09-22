import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const USER_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "CUSTOMER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["INVITED", "ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ACCOUNT_TYPES = [
  "BUSINESS_ENTERPRISE",
  "INDIVIDUAL",
  "GOVERNMENT",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

const NetworkInfoSchema = new Schema(
  {
    originNumber: { type: String, default: "" },
    originCountry: { type: String, default: "" },
    originIpAddress: { type: String, default: "" },
    originRegion: { type: String, default: "" },
    originState: { type: String, default: "" },
    destinationNumber: { type: String, default: "" },
    destinationNetwork: { type: String, default: "" },
    destinationCountry: { type: String, default: "" },
    destinationState: { type: String, default: "" },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, default: "" },
    role: { type: String, enum: USER_ROLES, required: true },

    customerId: { type: String, unique: true, sparse: true },

    passwordHash: { type: String, default: null, select: false },
    status: { type: String, enum: USER_STATUSES, default: "INVITED" },

    inviteTokenHash: { type: String, default: null, select: false },
    inviteTokenExpiry: { type: Date, default: null },

    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiry: { type: Date, default: null },

    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    mustChangePassword: { type: Boolean, default: false },
    tempPasswordIssuedAt: { type: Date, default: null },
    // A temporary (invitation) password stops working after this date; the
    // admin re-invites to issue a fresh one.
    tempPasswordExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    address: { type: String, default: "" },
    company: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // Customer-only profile fields
    accountType: { type: String, enum: ACCOUNT_TYPES, default: null },
    contactPerson: { type: String, default: "" },
    nidTradeLicense: { type: String, default: "" },
    // Legacy single Customer Code. Customer Codes now live on CustomerAccount
    // (models/CustomerAccount.ts) so one profile can own several accounts;
    // this field is kept only so existing data can be migrated from it.
    customerCode: { type: String, unique: true, sparse: true, index: true },
    cardName: { type: String, default: "", index: true },
    iccid: { type: String, default: "", index: true },
    imei: { type: String, default: "" },
    service: { type: String, default: "" },
    vendor: { type: String, default: "" },

    // Links this customer to a real device in the Starlink/SLASH API (see
    // lib/starlink/). Starlink has no ICCID concept, so this is a separate,
    // admin-entered identifier — not derived from iccid/imei above.
    starlinkVesselId: { type: String, default: "", index: true },
    starlinkServiceLineNumber: { type: String, default: "" },
    network: { type: NetworkInfoSchema, default: () => ({}) },

    // Portal users. A CUSTOMER user with customerProfile = null IS the
    // Customer Profile (and its primary login). Additional logins for the same
    // company are CUSTOMER users whose customerProfile points at that profile.
    customerProfile: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    // Which of the profile's Customer Accounts this login may see.
    // accountAccessAll = true also covers accounts added later.
    accountAccessAll: { type: Boolean, default: true },
    accountAccess: { type: [{ type: Schema.Types.ObjectId, ref: "CustomerAccount" }], default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ role: 1, customerProfile: 1 });
UserSchema.index({ createdAt: -1 });

/**
 * Matches Customer Profiles only (not the additional portal users that belong
 * to a profile). `customerProfile: null` also matches documents created before
 * the field existed.
 */
export const CUSTOMER_PROFILE_FILTER = { role: "CUSTOMER", customerProfile: null } as const;

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", UserSchema);
