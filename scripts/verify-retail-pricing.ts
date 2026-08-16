import "dotenv/config";
import assert from "node:assert/strict";
import { connectDB } from "@/lib/db/connect";
import { RetailPlan, type RetailPlanDoc } from "@/models/RetailPlan";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import { CdrChargeRecord } from "@/models/CdrChargeRecord";
import { CdrImportBatch } from "@/models/CdrImportBatch";
import { User } from "@/models/User";
import { calculateRetailCharge } from "@/lib/billing/pricingEngine";
import { parseRetailCsv } from "@/lib/cdr/retailCsvParser";
import type { HydratedDocument, Types } from "mongoose";

// NOTE: this runs standalone via `tsx` (not through Next's bundler), so it
// can't import anything that starts with `import "server-only"` (e.g.
// lib/cdr/retailCdrProcess.ts) — that marker package always throws outside
// Next's RSC build (see scripts/seed.ts for the same constraint). The
// DB-backed checks below replicate the same Mongoose queries
// retailCdrProcess.ts runs internally, against the real models/schema, so
// they still exercise real behavior (mapping lookup, the partial-unique
// active-mapping index, and the pricing snapshot) — just not through that
// one orchestration function's call signature.

const TEST_TAG = `VERIFY_${Date.now()}`;
let failures = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   - ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL - ${name}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ok   - ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL - ${name}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  console.log("Pricing engine (pure, no DB)");
  check("$10 wholesale + 50% markup = $15 retail", () => {
    const r = calculateRetailCharge(10, { pricingMethod: "PERCENTAGE_MARKUP", markupPercent: 50, fixedPrice: 0 });
    assert.equal(r.retailAmount, 15);
    assert.equal(r.markupAmount, 5);
    assert.equal(r.wholesaleAmount, 10);
  });
  check("Fixed $15 retail price = $15 regardless of wholesale", () => {
    const r = calculateRetailCharge(10, { pricingMethod: "FIXED_PRICE", markupPercent: 0, fixedPrice: 15 });
    assert.equal(r.retailAmount, 15);
  });
  check("decimal-safe rounding avoids floating-point drift ($19.99 + 15%)", () => {
    const r = calculateRetailCharge(19.99, { pricingMethod: "PERCENTAGE_MARKUP", markupPercent: 15, fixedPrice: 0 });
    // 1999 cents * 15 / 100 = 299.85 -> rounds to 300 cents = $3.00 markup
    assert.equal(r.markupAmount, 3.0);
    assert.equal(r.retailAmount, 22.99);
  });

  console.log("\nCSV parsing & row validation (pure, no DB)");
  check("multiple CDR records parse independently", () => {
    const csv = "Identifier,Wholesale\nA123,10\nB456,20\nA123,5\n";
    const { rows } = parseRetailCsv(csv);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.isValid));
  });
  check("missing identifier is marked invalid", () => {
    const csv = "Identifier,Wholesale\n,10\n";
    const { rows } = parseRetailCsv(csv);
    assert.equal(rows[0].isValid, false);
    assert.match(rows[0].invalidReason, /identifier/i);
  });
  check("invalid (non-numeric) wholesale amount is marked invalid", () => {
    const csv = "Identifier,Wholesale\nA123,not-a-number\n";
    const { rows } = parseRetailCsv(csv);
    assert.equal(rows[0].isValid, false);
    assert.match(rows[0].invalidReason, /wholesale/i);
  });

  console.log("\nDB-backed: identifier -> Retail Plan mapping + historical immutability");
  let plan: HydratedDocument<RetailPlanDoc> | null = null;
  let plan2Id: Types.ObjectId | null = null;
  let mapping: { _id: Types.ObjectId } | null = null;
  let batch: { _id: Types.ObjectId } | null = null;
  let matchedRecordId: Types.ObjectId | null = null;

  try {
    await connectDB();
    // Mongoose builds indexes in the background; explicitly sync this
    // model's indexes (including the partial-unique active-mapping one —
    // and dropping any stale index left over from an earlier schema
    // iteration during development) before relying on the DB to enforce it.
    await CdrIdentifierMapping.syncIndexes();
    const anyUser = await User.findOne().lean();
    if (!anyUser) throw new Error("No users exist in this database — can't create a CdrImportBatch to test against.");

    const identifier = `${TEST_TAG}_A123`;
    const unmatchedIdentifier = `${TEST_TAG}_UNMAPPED`;

    plan = await RetailPlan.create({
      name: `${TEST_TAG} Plan A`,
      pricingMethod: "PERCENTAGE_MARKUP",
      markupPercent: 50,
      fixedPrice: 0,
      currency: "USD",
      isActive: true,
    });
    mapping = await CdrIdentifierMapping.create({ identifier, retailPlan: plan._id, isActive: true });
    batch = await CdrImportBatch.create({
      fileName: `${TEST_TAG}.csv`,
      uploadedBy: anyUser._id,
      status: "PROCESSING",
    });

    await checkAsync("identifier resolves to its active Retail Plan and prices $10 -> $15", async () => {
      const activeMapping = await CdrIdentifierMapping.findOne({ identifier, isActive: true }).populate<{
        retailPlan: RetailPlanDoc & { _id: Types.ObjectId };
      }>("retailPlan");
      assert.ok(activeMapping, "mapping should exist");
      const p = activeMapping!.retailPlan;
      const pricing = calculateRetailCharge(10, {
        pricingMethod: p.pricingMethod,
        markupPercent: p.markupPercent,
        fixedPrice: p.fixedPrice,
      });
      assert.equal(pricing.retailAmount, 15);

      const record = await CdrChargeRecord.create({
        importBatch: batch!._id,
        identifier,
        wholesaleAmount: pricing.wholesaleAmount,
        currency: "USD",
        retailPlan: p._id,
        retailPlanName: p.name,
        pricingMethodUsed: pricing.pricingMethod,
        markupPercentUsed: pricing.markupPercentUsed,
        fixedPriceUsed: pricing.fixedPriceUsed,
        retailAmount: pricing.retailAmount,
        status: "MATCHED",
      });
      matchedRecordId = record._id;
    });

    await checkAsync("identifier with no active mapping is unmatched", async () => {
      const activeMapping = await CdrIdentifierMapping.findOne({ identifier: unmatchedIdentifier, isActive: true });
      assert.equal(activeMapping, null);

      const record = await CdrChargeRecord.create({
        importBatch: batch!._id,
        identifier: unmatchedIdentifier,
        wholesaleAmount: 10,
        currency: "USD",
        status: "UNMATCHED",
        errorReason: `No active Retail Plan is mapped to identifier "${unmatchedIdentifier}".`,
      });
      assert.equal(record.status, "UNMATCHED");
      assert.equal(record.retailAmount, 0);
    });

    await checkAsync("only one ACTIVE mapping per identifier is allowed", async () => {
      const plan2 = await RetailPlan.create({
        name: `${TEST_TAG} Plan B`,
        pricingMethod: "FIXED_PRICE",
        fixedPrice: 25,
        currency: "USD",
        isActive: true,
      });
      plan2Id = plan2._id;
      await assert.rejects(CdrIdentifierMapping.create({ identifier, retailPlan: plan2._id, isActive: true }));
    });

    await checkAsync("editing the Retail Plan later doesn't change an already-priced historical record", async () => {
      await RetailPlan.findByIdAndUpdate(plan!._id, { markupPercent: 90 });
      const reloaded = await CdrChargeRecord.findById(matchedRecordId).lean();
      assert.equal(reloaded!.retailAmount, 15, "historical retail amount must stay $15 despite the plan now being 90% markup");
      assert.equal(reloaded!.markupPercentUsed, 50, "historical markup snapshot must stay 50%");
    });
  } catch (err) {
    failures++;
    console.error(`  FAIL - DB-backed setup: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    // Each cleanup step runs independently so a transient failure on one
    // (e.g. a dropped connection) can't skip the rest and leave test data behind.
    const cleanupSteps: [string, () => Promise<unknown>][] = [
      ["CdrChargeRecord", () => (batch ? CdrChargeRecord.deleteMany({ importBatch: batch._id }) : Promise.resolve())],
      ["CdrImportBatch", () => (batch ? CdrImportBatch.deleteOne({ _id: batch._id }) : Promise.resolve())],
      ["CdrIdentifierMapping", () => (mapping ? CdrIdentifierMapping.deleteOne({ _id: mapping._id }) : Promise.resolve())],
      ["RetailPlan (B)", () => (plan2Id ? RetailPlan.deleteOne({ _id: plan2Id }) : Promise.resolve())],
      ["RetailPlan (A)", () => (plan ? RetailPlan.deleteOne({ _id: plan._id }) : Promise.resolve())],
    ];
    for (const [label, step] of cleanupSteps) {
      try {
        await step();
      } catch (err) {
        failures++;
        console.error(`  FAIL - cleanup (${label}): ${err instanceof Error ? err.message : String(err)}`);
        console.error(`         Test data tagged "${TEST_TAG}" may need manual removal.`);
      }
    }
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
