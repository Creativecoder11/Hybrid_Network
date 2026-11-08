import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { runThrottled } from "@/lib/utils/throttle";

// An invoice only becomes overdue when a due date passes, so re-running this
// write on every page load buys nothing. Once a minute per server process is
// plenty and keeps it off the critical path of most requests.
const SYNC_INTERVAL_MS = 60 * 1000;

/** Flips any DUE (or unsent SENT) invoice past its due date to OVERDUE. Call before reading invoice lists. */
export async function syncOverdueStatuses(): Promise<void> {
  return runThrottled("invoice-overdue-sync", SYNC_INTERVAL_MS, async () => {
    await connectDB();
    await Invoice.updateMany(
      { status: { $in: ["SENT", "DUE"] }, dueDate: { $lt: new Date() } },
      { $set: { status: "OVERDUE" } }
    );
  });
}
