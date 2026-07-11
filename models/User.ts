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

    address: { type: String, default: "" },
    company: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // Customer-only profile fields
    accountType: { type: String, enum: ACCOUNT_TYPES, default: null },
    contactPerson: { type: String, default: "" },
    nidTradeLicense: { type: String, default: "" },
    customerCode: { type: String, unique: true, sparse: true, index: true },
    cardName: { type: String, default: "", index: true },
    iccid: { type: String, default: "", index: true },
    imei: { type: String, default: "" },
    service: { type: String, default: "" },
    vendor: { type: String, default: "" },
    network: { type: NetworkInfoSchema, default: () => ({}) },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ createdAt: -1 });

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", UserSchema);
