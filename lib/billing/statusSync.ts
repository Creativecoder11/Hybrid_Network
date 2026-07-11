import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";

/** Flips any DUE (or unsent SENT) invoice past its due date to OVERDUE. Call before reading invoice lists. */
export async function syncOverdueStatuses(): Promise<void> {
  await connectDB();
  await Invoice.updateMany(
    { status: { $in: ["SENT", "DUE"] }, dueDate: { $lt: new Date() } },
    { $set: { status: "OVERDUE" } }
  );
}
