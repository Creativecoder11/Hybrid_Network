// Runs once when the Next.js server starts.
//
// The Node-only import must stay INSIDE this `NEXT_RUNTIME === "nodejs"`
// branch: webpack also compiles this file for the Edge runtime and only drops
// the import (and Mongoose, which needs Node's `net`) when the condition is
// written this way. An early `return` for non-Node runtimes is not enough.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runBootMigrations } = await import("./lib/migrations/boot");
    await runBootMigrations();
  }
}
