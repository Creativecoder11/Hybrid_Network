import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  User,
  CustomerAccount,
  Subscription,
  ServicePlan,
  RetailPlan,
  CdrIdentifierMapping,
  CdrImportBatch,
  CdrChargeRecord,
  Invoice,
  UsageRecord,
  SupportTicket,
  TerminalState,
  Settings,
  ActivityLog,
} from "@/models";

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

async function cleanDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }

  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log(`\nConnecting to MongoDB (${maskedUri})...`);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("No database instance found");
  }

  console.log(`✅ Connected to Database: "${db.databaseName}"`);
  console.log("\n--- Cleaning Old Demo / Test Data Collections ---");

  // 1. Delete all transactional & test data
  await Promise.all([
    Invoice.deleteMany({}),
    UsageRecord.deleteMany({}),
    Subscription.deleteMany({}),
    CustomerAccount.deleteMany({}),
    SupportTicket.deleteMany({}),
    CdrImportBatch.deleteMany({}),
    CdrChargeRecord.deleteMany({}),
    TerminalState.deleteMany({}),
    ActivityLog.deleteMany({}),
    db.collection("cdrbatches").deleteMany({}),
    db.collection("cdrrecords").deleteMany({}),
  ]);

  console.log("✔ Cleared Invoices, Usage Records, Subscriptions, Tickets, and CDR collections.");

  // 2. Clear old demo users and keep clean administrative accounts
  await User.deleteMany({});
  console.log("✔ Cleared old users.");

  console.log("\n--- Creating Clean Baseline Users ---");
  const superAdminPwHash = await hashPassword("Admin@12345");
  const subAdminPwHash = await hashPassword("Staff@12345");
  const clientPwHash = await hashPassword("Client@12345");

  const [superAdmin, subAdmin, mainCustomer] = await Promise.all([
    User.create({
      name: "System Administrator",
      email: "admin@hybridnetworks.com",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      passwordHash: superAdminPwHash,
      mustChangePassword: false,
      loginAttempts: 0,
    }),
    User.create({
      name: "Ayesha Staff",
      email: "ayesha@hybridnetworks.com",
      role: "SUB_ADMIN",
      status: "ACTIVE",
      passwordHash: subAdminPwHash,
      mustChangePassword: false,
      loginAttempts: 0,
    }),
    User.create({
      name: "Nur Mohammad Kawser",
      email: "nurmohammadkawser11@gmail.com",
      role: "CUSTOMER",
      status: "ACTIVE",
      passwordHash: clientPwHash,
      mustChangePassword: false,
      customerId: "HN-CUST-1001",
      customerCode: "ZZSP100",
      company: "Hybrid Networks Client Portal",
      starlinkVesselId: "STARLINK-V01",
      loginAttempts: 0,
    }),
  ]);

  // Create linked CustomerAccounts for multi-account support
  await Promise.all([
    CustomerAccount.create({
      customer: mainCustomer._id,
      accountNumber: "ZZSP100",
      accountNumberNormalized: "ZZSP100",
      name: "Primary Vessel - Pacific Star",
      status: "ACTIVE",
      starlinkVesselIds: ["STARLINK-V01"],
    }),
    CustomerAccount.create({
      customer: mainCustomer._id,
      accountNumber: "ACC-2001",
      accountNumberNormalized: "ACC-2001",
      name: "Secondary Vessel - Atlantic Explorer",
      status: "ACTIVE",
    }),
  ]);

  console.log(`✔ Super Admin: ${superAdmin.email} (Password: Admin@12345)`);
  console.log(`✔ Sub Admin: ${subAdmin.email} (Password: Staff@12345)`);
  console.log(`✔ Customer: ${mainCustomer.email} (Accounts: ZZSP100, ACC-2001 | Password: Client@12345)`);

  // 3. Reset Global Settings
  console.log("\n--- Initializing Global Settings ---");
  await Settings.deleteMany({});
  await Settings.create({
    key: "GLOBAL",
    companyName: "Hybrid Networks",
    companyLegalName: "Hybrid Networks Pty Ltd",
    companyEmail: "billing@hybridnetworks.com",
    companyPhone: "+61 2 9000 1000",
    companyAddress: "Level 12, 100 Barangaroo Avenue, Sydney NSW 2000, Australia",
    companyAbn: "51 824 753 556",
    currency: "AUD",
    taxLabel: "GST",
    taxRate: 10,
    invoicePrefix: "HINV",
    invoiceNextNumber: 1001,
    paymentInstructions:
      "Direct Bank Transfer:\nBank: Westpac Banking Corporation\nBSB: 032-000\nAccount Number: 12345678\nAccount Name: Hybrid Networks Pty Ltd\nReference: Please quote your Invoice Number",
  });
  console.log("✔ Global Settings initialized (HINV-1001, GST 10%, AUD).");

  // 4. Create Service Plans Catalog
  console.log("\n--- Initializing Service Plans Catalog ---");
  await ServicePlan.deleteMany({});
  const [starlinkPlan, maritimePlan, enterprisePlan] = await Promise.all([
    ServicePlan.create({
      name: "Business Starlink Standard",
      provider: "Starlink",
      planType: "DATA",
      monthlyPrice: 1299,
      currency: "AUD",
      dataAllowanceGB: 500,
      speedMbps: 100,
      sharedRatio: "1:1",
      overageRatePerGB: 2.5,
      isActive: true,
    }),
    ServicePlan.create({
      name: "Maritime Satellite Premium",
      provider: "Starlink",
      planType: "HYBRID",
      monthlyPrice: 2499,
      currency: "AUD",
      dataAllowanceGB: 1000,
      voiceMinutes: 500,
      smsCount: 100,
      speedMbps: 220,
      sharedRatio: "1:1",
      overageRatePerGB: 3.0,
      isActive: true,
    }),
    ServicePlan.create({
      name: "Enterprise Dedicated Leased Line",
      provider: "Fiber",
      planType: "DATA",
      monthlyPrice: 4999,
      currency: "AUD",
      dataAllowanceGB: 2000,
      speedMbps: 500,
      sharedRatio: "1:1",
      overageRatePerGB: 2.0,
      isActive: true,
    }),
  ]);
  console.log("✔ Service Plans created: Business Starlink, Maritime Satellite, Enterprise Leased Line.");

  // 5. Create Retail Pricing Markup Plans
  console.log("\n--- Initializing Retail Pricing Markup Plans ---");
  await RetailPlan.deleteMany({});
  const markup50Plan = await RetailPlan.create({
    name: "Standard 50% Markup",
    description: "Client standard pricing: 50% markup applied over wholesale CDR cost.",
    pricingMethod: "PERCENTAGE_MARKUP",
    markupPercent: 50,
    fixedPrice: 0,
    currency: "AUD",
    isActive: true,
    createdBy: superAdmin._id,
  });

  const fixedVoicePlan = await RetailPlan.create({
    name: "Fixed Voice Rate ($2.50/min)",
    description: "Fixed charge per voice transaction unit.",
    pricingMethod: "FIXED_PRICE",
    markupPercent: 0,
    fixedPrice: 2.5,
    currency: "AUD",
    isActive: true,
    createdBy: superAdmin._id,
  });
  console.log("✔ Retail Plans created: Standard 50% Markup, Fixed Voice Rate.");

  // 6. Create Default CDR Identifier Mappings
  console.log("\n--- Initializing CDR Product Code Mappings ---");
  await CdrIdentifierMapping.deleteMany({});
  await Promise.all([
    CdrIdentifierMapping.create({
      identifier: "Type,CALL – CODE- 123",
      name: "Voice Calls - Code 123",
      productType: "CALL",
      description: "Standard voice call telecom usage",
      retailPlan: markup50Plan._id,
      isActive: true,
      createdBy: superAdmin._id,
    }),
    CdrIdentifierMapping.create({
      identifier: "Type,SMS – CODE 245",
      name: "SMS Messaging - Code 245",
      productType: "SMS",
      description: "Outbound SMS messaging stream",
      retailPlan: markup50Plan._id,
      isActive: true,
      createdBy: superAdmin._id,
    }),
    CdrIdentifierMapping.create({
      identifier: "DATA – CODE 789",
      name: "Satellite Data Traffic - Code 789",
      productType: "DATA",
      description: "Standard payload data usage stream",
      retailPlan: markup50Plan._id,
      isActive: true,
      createdBy: superAdmin._id,
    }),
  ]);
  console.log("✔ CDR Product Mappings registered (CALL-123, SMS-245, DATA-789).");

  // 7. Create Active Subscription for Main Customer
  console.log("\n--- Creating Clean Subscription for Customer ---");
  await Subscription.create({
    customer: mainCustomer._id,
    plan: maritimePlan._id,
    status: "ACTIVE",
    staticIp: "103.21.144.52",
    terminalIds: ["TERM-STARLINK-001"],
    startDate: new Date(),
  });
  console.log("✔ Customer Subscription assigned (Maritime Satellite Premium).");

  // 8. Log System Audit
  await ActivityLog.create({
    actor: superAdmin._id,
    action: "SETTINGS_UPDATED",
    meta: { note: "Database cleanly initialized with fresh baseline configuration." },
  });

  console.log("\n==========================================================");
  console.log("🎉 DATABASE CLEAN SLATE COMPLETED SUCCESSFULLY!");
  console.log("==========================================================\n");

  await mongoose.disconnect();
}

cleanDatabase().catch((err) => {
  console.error("❌ Error cleaning database:", err);
  process.exit(1);
});
