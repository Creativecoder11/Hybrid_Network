import { runPendingMigrations } from "./index";

// Applies pending data migrations when the Node.js server starts, so a
// deploy never serves the multi-account code against un-migrated data
// (Hostinger's hPanel has no release-phase hook to run `npm run migrate`).
// Failures are logged, not fatal — the site keeps serving and the migration
// is retried on the next start.
export async function runBootMigrations(): Promise<void> {
  if (process.env.SKIP_BOOT_MIGRATIONS === "true") return;
  // Never during `next build` — only a running server migrates its database.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    const { applied } = await runPendingMigrations();
    if (applied.length > 0) console.log(`[migrations] applied at startup: ${applied.join(", ")}`);
  } catch (err) {
    console.error("[migrations] startup migration failed — will retry on next start:", err);
  }
}
