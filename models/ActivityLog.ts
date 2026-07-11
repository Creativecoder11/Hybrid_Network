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
  "PASSWORD_SET",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET",
  "TEAM_MEMBER_CREATED",
  "TEAM_MEMBER_SUSPENDED",
  "PLAN_CREATED",
  "PLAN_UPDATED",
  "PLAN_CHANGED",
  "CDR_UPLOAD",
  "USAGE_MANUAL_UPDATE",
  "INVOICE_CREATED",
  "INVOICE_SENT",
  "INVOICE_PAID",
  "INVOICE_CANCELLED",
  "TICKET_CREATED",
  "TICKET_REPLIED",
  "TICKET_STATUS_CHANGED",
  "TICKET_ASSIGNED",
  "SETTINGS_UPDATED",
  "TERMINAL_COMMAND",
  "TERMINAL_STATUS_CHANGED",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

const ActivityLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    targetCustomer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
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
