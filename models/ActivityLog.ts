import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const ACTIVITY_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "CUSTOMER_CREATED",
  "CUSTOMER_UPDATED",
  "CUSTOMER_SUSPENDED",
  "CUSTOMER_REACTIVATED",
  "CUSTOMER_DELETED",
  "INVITE_SENT",
  "INVITE_RESENT",
  "CREDENTIALS_SENT",
  "PASSWORD_SET",
  "FIRST_LOGIN_PASSWORD_SET",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET",
  "TEAM_MEMBER_CREATED",
  "TEAM_MEMBER_SUSPENDED",
  "PLAN_CREATED",
  "PLAN_UPDATED",
  "PLAN_CHANGED",
  "CDR_UPLOAD",
  "USAGE_MANUAL_UPDATE",
  "RETAIL_PLAN_CREATED",
  "RETAIL_PLAN_UPDATED",
  "RETAIL_PLAN_DELETED",
  "CDR_MAPPING_CREATED",
  "CDR_MAPPING_UPDATED",
  "CDR_MAPPING_DELETED",
  "CDR_PRICING_IMPORT",
  "CDR_PRICING_REPROCESSED",
  "CDR_CHARGES_INVOICED",
  "INVOICE_CREATED",
  "INVOICE_UPDATED",
  "INVOICE_SENT",
  "INVOICE_PAID",
  "INVOICE_CANCELLED",
  "INVOICE_DELETED",
  "INVOICE_RESTORED",
  "INVOICE_PURGED",
  "TICKET_CREATED",
  "TICKET_REPLIED",
  "TICKET_STATUS_CHANGED",
  "TICKET_ASSIGNED",
  "SETTINGS_UPDATED",
  "TERMINAL_COMMAND",
  "TERMINAL_STATUS_CHANGED",
  "INVITE_EXPIRED_LOGIN",
  "CUSTOMER_ACCOUNT_CREATED",
  "CUSTOMER_ACCOUNT_UPDATED",
  "CUSTOMER_ACCOUNT_DELETED",
  "PORTAL_USER_CREATED",
  "PORTAL_USER_UPDATED",
  "PORTAL_USER_SUSPENDED",
  "PORTAL_USER_REACTIVATED",
  "PORTAL_USER_DELETED",
  "ACCOUNT_ACCESS_UPDATED",
  "CDR_UNALLOCATED_ALERT",
  "CDR_UNALLOCATED_REPROCESSED",
  "CDR_ALERT_ACKNOWLEDGED",
  "FEATURE_LOCATION_CHANGED",
  "FEATURE_TRACKING_CHANGED",
  "SLASH_WRITE_OPERATION",
  "SLASH_WRITE_FAILED",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

const ActivityLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    targetCustomer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetAccount: { type: Schema.Types.ObjectId, ref: "CustomerAccount", default: null, index: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof ActivityLogSchema>;

export const ActivityLog: Model<ActivityLogDoc> =
  (mongoose.models.ActivityLog as Model<ActivityLogDoc>) ||
  mongoose.model<ActivityLogDoc>("ActivityLog", ActivityLogSchema);
