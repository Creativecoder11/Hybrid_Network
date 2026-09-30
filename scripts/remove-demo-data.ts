import "dotenv/config";
import mongoose, { type Types } from "mongoose";

// Removes the demo/sample records created by scripts/seed.ts and
// scripts/clean-database.ts, and nothing else.
//
//   npx tsx scripts/remove-demo-data.ts                    # dry run: lists what would change
//   npx tsx scripts/remove-demo-data.ts --apply --db=NAME  # applies; NAME must match the database
//
// Only records positively identified as demo data are touched:
//   - demo customers (the seed/clean-script emails, or any *.example /
//     @example.com address) with their accounts, subscriptions, usage,
//     invoices, recurring schedules, tickets, portal users and activity log;
//   - the demo service plans, retail plans and product codes, but only when
//     nothing that is kept still uses them;
//   - demo company details in Settings, only where they still hold the exact
//     demo value (so details you've since entered are left alone).
// CDR rows allocated to a demo customer are kept and marked unallocated, the
// same as deleting a customer in the admin portal. Admin logins are never
// deleted; demo admin logins are listed so their passwords can be changed.

const APPLY = process.argv.includes("--apply");
const DB_ARG = process.argv.find((a) => a.startsWith("--db="))?.slice(5);

const DEMO_CUSTOMER_EMAILS = [
  "ops@ni-apac-support.example",
  "admin@marinehorizon.example",
  "rajesh.kumar@example.com",
  "it@selangordistrict.example.gov",
  "manager@coralbayresort.example",
  "nurmohammadkawser11@gmail.com", // clean-database.ts demo customer
];
const DEMO_EMAIL_PATTERN = /(\.example(\.[a-z]+)?|@example\.com)$/i;
const DEMO_ADMIN_EMAILS = ["admin@hybridnetworks.com", "ayesha@hybridnetworks.com"];

const DEMO_SERVICE_PLANS = [
  "Maritime Satellite Plan",
  "Enterprise Leased Line",
  "Business Starlink Standard",
  "Maritime Satellite Premium",
  "Enterprise Dedicated Leased Line",
];
const DEMO_RETAIL_PLANS = ["Standard 50% Markup", "Fixed Voice Rate ($2.50/min)"];
const DEMO_PRODUCT_CODES = ["Type,CALL – CODE- 123", "Type,SMS – CODE 245", "DATA – CODE 789"];

// Exact demo values written by clean-database.ts.
const DEMO_SETTINGS: Record<string, string> = {
  companyAbn: "51 824 753 556",
  companyAddress: "Level 12, 100 Barangaroo Avenue, Sydney NSW 2000, Australia",
  companyPhone: "+61 2 9000 1000",
  companyEmail: "billing@hybridnetworks.com",
  paymentInstructions:
    "Direct Bank Transfer:\nBank: Westpac Banking Corporation\nBSB: 032-000\nAccount Number: 12345678\nAccount Name: Hybrid Networks Pty Ltd\nReference: Please quote your Invoice Number",
};

type Id = Types.ObjectId;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection.");

  const host = uri.replace(/\/\/[^@]+@/, "//***@").replace(/\?.*$/, "");
  console.log(`Database: "${db.databaseName}" on ${host}`);
  console.log(APPLY ? "Mode: APPLY (changes will be written)\n" : "Mode: DRY RUN (nothing is changed)\n");
  if (APPLY && DB_ARG !== db.databaseName) {
    throw new Error(`Refusing to apply: pass --db=${db.databaseName} to confirm this is the database you mean.`);
  }

  const c = (name: string) => db.collection(name);
  const ids = (docs: { _id: Id }[]) => docs.map((d) => d._id);

  // Demo customer profiles, plus any additional portal users under them.
  const profiles = await c("users")
    .find({ role: "CUSTOMER", customerProfile: null })
    .project<{ _id: Id; email: string; name: string }>({ email: 1, name: 1 })
    .toArray();
  const demoProfiles = profiles.filter((u) => DEMO_CUSTOMER_EMAILS.includes(u.email) || DEMO_EMAIL_PATTERN.test(u.email));
  const profileIds = ids(demoProfiles);
  const portalUsers = await c("users").find({ customerProfile: { $in: profileIds } }).project<{ _id: Id }>({}).toArray();
  const accounts = await c("customeraccounts").find({ customer: { $in: profileIds } }).project<{ _id: Id; accountNumber: string }>({ accountNumber: 1 }).toArray();
  const accountIds = ids(accounts);
  const byCustomer = { $or: [{ customer: { $in: profileIds } }, { customerAccount: { $in: accountIds } }] };

  const invoices = await c("invoices").find(byCustomer).project<{ _id: Id }>({}).toArray(); // includes trashed
  const invoiceIds = ids(invoices);

  const counts = {
    subscriptions: await c("subscriptions").countDocuments(byCustomer),
    usageRecords: await c("usagerecords").countDocuments(byCustomer),
    invoices: invoiceIds.length,
    recurringInvoices: await c("recurringinvoices").countDocuments(byCustomer),
    supportTickets: await c("supporttickets").countDocuments({ customer: { $in: profileIds } }),
    activityLog: await c("activitylogs").countDocuments({ targetCustomer: { $in: profileIds } }),
    cdrRowsToUnallocate: await c("cdrrecords").countDocuments(byCustomer),
    cdrChargesToUnallocate: await c("cdrchargerecords").countDocuments(byCustomer),
    demoTerminalState: await c("terminalstates").countDocuments({}),
  };

  console.log(`Demo customers (${demoProfiles.length}):`);
  for (const p of demoProfiles) console.log(`  - ${p.name} <${p.email}>`);
  console.log(`  + ${portalUsers.length} additional portal user(s), ${accounts.length} account(s): ${accounts.map((a) => a.accountNumber).join(", ") || "none"}`);
  console.log("Related records:", counts);

  // Catalogue entries: only when nothing that is being kept still uses them.
  const keptSubs = { customer: { $nin: profileIds } };
  const plans = await c("serviceplans").find({ name: { $in: DEMO_SERVICE_PLANS } }).project<{ _id: Id; name: string }>({ name: 1 }).toArray();
  const removablePlans: typeof plans = [];
  for (const p of plans) {
    const inUse = await c("subscriptions").countDocuments({ ...keptSubs, plan: p._id });
    if (inUse === 0) removablePlans.push(p);
    else console.log(`  keep service plan "${p.name}" — used by ${inUse} real subscription(s)`);
  }

  const codes = await c("cdridentifiermappings").find({ identifier: { $in: DEMO_PRODUCT_CODES } }).project<{ _id: Id; identifier: string }>({ identifier: 1 }).toArray();
  const removableCodes: typeof codes = [];
  for (const m of codes) {
    const inUse = (await c("cdrrecords").countDocuments({ product: m._id })) + (await c("cdrchargerecords").countDocuments({ product: m._id }));
    if (inUse === 0) removableCodes.push(m);
    else console.log(`  keep product code "${m.identifier}" — used by ${inUse} CDR row(s)`);
  }

  const retail = await c("retailplans").find({ name: { $in: DEMO_RETAIL_PLANS } }).project<{ _id: Id; name: string }>({ name: 1 }).toArray();
  const removableRetail: typeof retail = [];
  for (const r of retail) {
    const mappings = await c("cdridentifiermappings").countDocuments({ retailPlan: r._id, _id: { $nin: ids(removableCodes) } });
    const charges = await c("cdrchargerecords").countDocuments({ retailPlan: r._id });
    if (mappings + charges === 0) removableRetail.push(r);
    else console.log(`  keep retail plan "${r.name}" — used by ${mappings} product code(s) / ${charges} charge(s)`);
  }

  console.log(`Demo service plans to remove: ${removablePlans.map((p) => p.name).join(", ") || "none"}`);
  console.log(`Demo retail plans to remove: ${removableRetail.map((p) => p.name).join(", ") || "none"}`);
  console.log(`Demo product codes to remove: ${removableCodes.map((m) => m.identifier).join(", ") || "none"}`);

  const settings = await c("settings").findOne({ key: "GLOBAL" });
  const settingsToClear = Object.entries(DEMO_SETTINGS)
    .filter(([k, v]) => settings?.[k] === v)
    .map(([k]) => k);
  console.log(`Demo company details to clear in Settings: ${settingsToClear.join(", ") || "none"}`);

  const demoAdmins = await c("users")
    .find({ email: { $in: DEMO_ADMIN_EMAILS }, role: { $in: ["SUPER_ADMIN", "SUB_ADMIN"] } })
    .project<{ email: string }>({ email: 1 })
    .toArray();

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply --db=" + db.databaseName + " to make these changes.");
  } else {
    const allUserIds = [...profileIds, ...ids(portalUsers)];
    await c("cdrrecords").updateMany(byCustomer, {
      $set: { customer: null, customerAccount: null, allocationStatus: "UNALLOCATED", unallocatedReasonCode: "CUSTOMER_NOT_FOUND" },
    });
    await c("cdrchargerecords").updateMany(byCustomer, {
      $set: { customer: null, customerAccount: null, status: "UNMATCHED", unallocatedReasonCode: "CUSTOMER_CODE_NOT_FOUND" },
    });
    await c("cdrchargerecords").updateMany({ invoice: { $in: invoiceIds } }, { $set: { invoice: null } });
    await Promise.all([
      c("invoices").deleteMany({ _id: { $in: invoiceIds } }),
      c("recurringinvoices").deleteMany(byCustomer),
      c("subscriptions").deleteMany(byCustomer),
      c("usagerecords").deleteMany(byCustomer),
      c("supporttickets").deleteMany({ customer: { $in: profileIds } }),
      c("activitylogs").deleteMany({ targetCustomer: { $in: profileIds } }),
      c("terminalstates").deleteMany({}),
    ]);
    await c("customeraccounts").deleteMany({ _id: { $in: accountIds } });
    await c("users").deleteMany({ _id: { $in: allUserIds } });
    await c("serviceplans").deleteMany({ _id: { $in: ids(removablePlans) } });
    await c("cdridentifiermappings").deleteMany({ _id: { $in: ids(removableCodes) } });
    await c("retailplans").deleteMany({ _id: { $in: ids(removableRetail) } });
    if (settingsToClear.length > 0) {
      await c("settings").updateOne({ key: "GLOBAL" }, { $set: Object.fromEntries(settingsToClear.map((k) => [k, ""])) });
    }
    console.log("\nDone. Demo data removed.");
    if (settingsToClear.length > 0) console.log("Enter your real company details in Admin → Settings before sending invoices.");
  }

  if (demoAdmins.length > 0) {
    console.log(
      `\nWARNING: demo admin login(s) still exist with passwords published in this repo: ${demoAdmins.map((a) => a.email).join(", ")}.` +
        "\nChange their passwords (or replace them with real admin accounts in Admin → Team) — they are not deleted automatically so you can't lock yourself out."
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
