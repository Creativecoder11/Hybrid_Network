import { connectDB } from "@/lib/db/connect";
import { Migration } from "@/models/Migration";
import { migrateCustomerAccounts } from "./001-customer-accounts";
import { backfillAccountLinks } from "./002-account-backfill";

// Ordered list of data migrations. Each must be idempotent and
// non-destructive to records. Deliberately free of `server-only` so the same
// code runs from `npm run migrate` (tsx) and from instrumentation.ts at boot.
const MIGRATIONS: { name: string; run: (log: (msg: string) => void) => Promise<unknown> }[] = [
  { name: "001-customer-accounts", run: migrateCustomerAccounts },
  { name: "002-account-backfill", run: backfillAccountLinks },
];

// A RUNNING row older than this is treated as a crashed run and retried.
const STALE_LOCK_MS = 15 * 60 * 1000;

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

async function claim(name: string): Promise<boolean> {
  const existing = await Migration.findOne({ name }).lean();
  if (existing?.status === "DONE") return false;
  if (existing && Date.now() - new Date(existing.startedAt).getTime() < STALE_LOCK_MS) return false;
  if (existing) {
    const res = await Migration.updateOne(
      { name, status: "RUNNING", startedAt: existing.startedAt },
      { $set: { startedAt: new Date() } }
    );
    return res.modifiedCount === 1;
  }
  try {
    await Migration.create({ name, status: "RUNNING", startedAt: new Date() });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false; // another instance got there first
    throw err;
  }
}

export async function runPendingMigrations(
  log: (msg: string) => void = (msg) => console.log(`[migrations] ${msg}`)
): Promise<{ applied: string[]; skipped: string[] }> {
  await connectDB();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of MIGRATIONS) {
    if (!(await claim(migration.name))) {
      skipped.push(migration.name);
      continue;
    }
    log(`running ${migration.name}`);
    try {
      const summary = await migration.run((msg) => log(`${migration.name}: ${msg}`));
      await Migration.updateOne(
        { name: migration.name },
        { $set: { status: "DONE", appliedAt: new Date(), summary: summary ?? {} } }
      );
      applied.push(migration.name);
    } catch (err) {
      // Release the lock so the next boot (or `npm run migrate`) retries, and
      // stop: later migrations may depend on this one.
      await Migration.deleteOne({ name: migration.name, status: "RUNNING" });
      log(`${migration.name} FAILED: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      throw err;
    }
  }

  return { applied, skipped };
}
