import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Lightweight, mutable overlay on top of the (mock or real) terminal data
// source, so admin remote commands (suspend, reactivate, firmware update...)
// persist across requests even though the bulk of terminal telemetry is
// generated/fetched fresh each time rather than stored in our own DB.
const TerminalStateSchema = new Schema(
  {
    terminalId: { type: String, required: true, unique: true }, // = ICCID
    statusOverride: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "DEACTIVATED", "SUSPENDED", "PENDING_ACTIVATION", "CANCELLED"],
      default: null,
    },
    firmwareUpdating: { type: Boolean, default: false },
    lastDiagnosticsRequestedAt: { type: Date, default: null },
    lastCommandAction: { type: String, default: "" },
    lastCommandAt: { type: Date, default: null },
    lastCommandBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export type TerminalStateDoc = InferSchemaType<typeof TerminalStateSchema>;

export const TerminalState: Model<TerminalStateDoc> =
  (mongoose.models.TerminalState as Model<TerminalStateDoc>) ||
  mongoose.model<TerminalStateDoc>("TerminalState", TerminalStateSchema);
