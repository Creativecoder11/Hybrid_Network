import "dotenv/config";
import mongoose from "mongoose";
import { runPendingMigrations } from "@/lib/migrations";

// Applies any pending data migrations (lib/migrations/). Safe to run more
// than once — applied migrations are recorded in the `migrations` collection.
// The server also runs this automatically at startup (instrumentation.ts).
async function main() {
  const { applied, skipped } = await runPendingMigrations();
  console.log(`Applied: ${applied.length ? applied.join(", ") : "none"}`);
  console.log(`Already applied / in progress elsewhere: ${skipped.length ? skipped.join(", ") : "none"}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
