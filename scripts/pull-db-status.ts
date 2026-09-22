import "dotenv/config";
import mongoose from "mongoose";

async function pullDatabaseStatus() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }

  // Mask credentials for display
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log(`Connecting to MongoDB (${maskedUri})...\n`);

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("No database instance found");
    }

    console.log(`✅ Connected to Database: "${db.databaseName}"\n`);
    console.log("================ COLLECTION OVERVIEW ================");

    const collections = await db.listCollections().toArray();
    if (collections.length === 0) {
      console.log("No collections found in this database.");
      await mongoose.disconnect();
      return;
    }

    const summary: { collection: string; count: number }[] = [];

    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      summary.push({ collection: col.name, count });
    }

    // Sort alphabetically
    summary.sort((a, b) => a.collection.localeCompare(b.collection));
    console.table(summary);

    console.log("\n================ DETAILED DATA INSPECTION ================\n");

    // 1. Users
    const usersCol = db.collection("users");
    const userCount = await usersCol.countDocuments();
    console.log(`📌 USERS (Total: ${userCount}):`);
    const users = await usersCol
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    users.forEach((u, i) => {
      console.log(
        `  [${i + 1}] Role: ${u.role} | Email: ${u.email} | Name: ${u.firstName || ""} ${u.lastName || ""} | Code: ${u.customerCode || "N/A"} | Codes: ${JSON.stringify(u.customerCodes || [])} | MustChangePW: ${u.mustChangePassword ?? false} | Created: ${u.createdAt ? new Date(u.createdAt).toISOString() : "N/A"}`
      );
    });

    // 2. Service Plans
    const plansCol = db.collection("serviceplans");
    const planCount = await plansCol.countDocuments();
    console.log(`\n📌 SERVICE PLANS (Total: ${planCount}):`);
    const plans = await plansCol.find({}).sort({ monthlyPrice: 1 }).limit(5).toArray();
    plans.forEach((p, i) => {
      console.log(`  [${i + 1}] Name: ${p.name} | Price: $${p.monthlyPrice} | Speeds: ${p.downloadSpeed}/${p.uploadSpeed} Mbps | Data: ${p.dataLimitGB || "Unlimited"} GB`);
    });

    // 3. Retail Plans & Pricing Rules
    const retailPlansCol = db.collection("retailplans");
    const retailCount = await retailPlansCol.countDocuments();
    console.log(`\n📌 RETAIL PRICING PLANS (Total: ${retailCount}):`);
    const retailPlans = await retailPlansCol.find({}).limit(5).toArray();
    retailPlans.forEach((r, i) => {
      console.log(`  [${i + 1}] Name: ${r.name} | Type: ${r.planType} | Markup: ${r.markupPercentage || 0}% | Fixed: $${r.fixedPrice || 0} | Status: ${r.status}`);
    });

    // 4. CDR Batches
    const cdrBatchesCol = db.collection("cdrimportbatches");
    const batchCount = await cdrBatchesCol.countDocuments();
    console.log(`\n📌 CDR IMPORT BATCHES (Total: ${batchCount}):`);
    const batches = await cdrBatchesCol.find({}).sort({ createdAt: -1 }).limit(5).toArray();
    batches.forEach((b, i) => {
      console.log(`  [${i + 1}] File: ${b.fileName} | Total Rows: ${b.totalRows} | Matched: ${b.matchedRows} | Unmatched: ${b.unmatchedRows} | Date: ${b.createdAt ? new Date(b.createdAt).toISOString() : "N/A"}`);
    });

    // 5. Invoices
    const invoicesCol = db.collection("invoices");
    const invoiceCount = await invoicesCol.countDocuments();
    console.log(`\n📌 INVOICES (Total: ${invoiceCount}):`);
    const invoices = await invoicesCol.find({}).sort({ createdAt: -1 }).limit(5).toArray();
    invoices.forEach((inv, i) => {
      console.log(`  [${i + 1}] Invoice #: ${inv.invoiceNumber} | Period: ${inv.billingPeriod || inv.periodMonth} | Subtotal: $${inv.subtotal} | Total: $${inv.totalAmount || inv.total} | Status: ${inv.status} | Created: ${inv.createdAt ? new Date(inv.createdAt).toISOString() : "N/A"}`);
    });

    // 6. Subscriptions
    const subCol = db.collection("subscriptions");
    const subCount = await subCol.countDocuments();
    console.log(`\n📌 SUBSCRIPTIONS (Total: ${subCount}):`);
    const subs = await subCol.find({}).sort({ createdAt: -1 }).limit(5).toArray();
    subs.forEach((s, i) => {
      console.log(`  [${i + 1}] Customer ID: ${s.customerId} | Plan ID: ${s.planId} | Status: ${s.status} | Terminal: ${s.terminalId || "N/A"} | Start: ${s.startDate ? new Date(s.startDate).toISOString() : "N/A"}`);
    });

    // 7. Activity Logs
    const logCol = db.collection("activitylogs");
    const logCount = await logCol.countDocuments();
    console.log(`\n📌 RECENT ACTIVITY LOGS (Total: ${logCount}):`);
    const logs = await logCol.find({}).sort({ createdAt: -1 }).limit(5).toArray();
    logs.forEach((l, i) => {
      console.log(`  [${i + 1}] Action: ${l.action} | Actor: ${l.actorRole} | Target: ${l.targetCustomer || "N/A"} | Time: ${l.createdAt ? new Date(l.createdAt).toISOString() : "N/A"}`);
    });

    console.log("\n================ END OF DATABASE REPORT ================\n");

    await mongoose.disconnect();
  } catch (err: any) {
    console.error("❌ Database inspection error:", err?.message || err);
    process.exit(1);
  }
}

pullDatabaseStatus();

