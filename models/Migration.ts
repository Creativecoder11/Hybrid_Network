import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Records which data migrations (lib/migrations/) have been applied, so each
// runs exactly once per database — whether triggered by `npm run migrate` or
// automatically at server start (instrumentation.ts).
// The unique name doubles as a lock: the admin and customer deployments share
// one database and may boot at the same moment, and only the process that
// inserts the RUNNING row gets to run the migration.
const MigrationSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    status: { type: String, enum: ["RUNNING", "DONE"], default: "RUNNING" },
    startedAt: { type: Date, default: Date.now },
    appliedAt: { type: Date, default: null },
    summary: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: false }
);

export type MigrationDoc = InferSchemaType<typeof MigrationSchema>;

export const Migration: Model<MigrationDoc> =
  (mongoose.models.Migration as Model<MigrationDoc>) ||
  mongoose.model<MigrationDoc>("Migration", MigrationSchema);
