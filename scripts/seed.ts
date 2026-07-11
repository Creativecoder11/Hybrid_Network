import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import {
  User,
  ServicePlan,
  Subscription,
  UsageRecord,
  Invoice,
  SupportTicket,
  ActivityLog,
  Settings,
} from "@/models";

// NOTE: this script runs standalone via `tsx` (not through Next's bundler),
// so it can't import lib/auth/* or lib/utils/ids.ts — those files start with
// `import "server-only"`, which throws when required outside Next's build.
// The small bits of logic needed here are reimplemented inline instead.

const GB = 1_000_000_000;
const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function generateCustomerId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const count = await User.countDocuments({ role: "CUSTOMER" });
    const sequential = (count + 1 + attempt).toString().padStart(4, "0");
    const suffix = Math.floor(Math.random() * 10).toString();
    const candidate = `HN-CUST-${sequential}${suffix}`;
    const exists = await User.exists({ customerId: candidate });
    if (!exists) return candidate;
  }
  return `HN-CUST-${Date.now().toString().slice(-5)}`;
}

async function generateInvoiceNumber(): Promise<string> {
  const settings = await Settings.findOneAndUpdate(
    { key: "GLOBAL" },
    { $inc: { invoiceNextNumber: 1 }, $setOnInsert: { key: "GLOBAL" } },
    { upsert: true, returnDocument: "before" }
  );
  const prefix = settings?.invoicePrefix || "HINV";
  const nextNumber = settings?.invoiceNextNumber ?? 1001;
  return `${prefix}-${nextNumber}`;
}

async function generateTicketNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await SupportTicket.exists({ ticketNumber: candidate });
    if (!exists) return candidate;
  }
  return `TCK-${Date.now().toString().slice(-6)}`;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  await connectDB();
  console.log("Connected to MongoDB. Clearing existing collections...");

  await Promise.all([
    User.deleteMany({}),
    ServicePlan.deleteMany({}),
    Subscription.deleteMany({}),
    UsageRecord.deleteMany({}),
    Invoice.deleteMany({}),
    SupportTicket.deleteMany({}),
    ActivityLog.deleteMany({}),
    Settings.deleteMany({}),
  ]);

  // ---------- Settings ----------
  await Settings.create({
    key: "GLOBAL",
    companyName: "Hybrid Networks",
    companyAddress: "Level 12, Menara Hybrid, Jalan Ampang, 50450 Kuala Lumpur, Malaysia",
    companyEmail: "billing@hybridnetworks.com",
    companyPhone: "+60 3-2145 8890",
    currency: "MYR",
    taxLabel: "GST",
    taxRate: 6,
    invoicePrefix: "HINV",
    invoiceNextNumber: 1001,
    timezone: "Asia/Dhaka",
  });
  console.log("Settings seeded.");

  // ---------- Admins ----------
  const superAdminPassword = "HybridAdmin@123";
  const superAdmin = await User.create({
    name: "System Administrator",
    email: "admin@hybridnetworks.com",
    phone: "+60 12-345 6789",
    role: "SUPER_ADMIN",
    passwordHash: await hashPassword(superAdminPassword),
    status: "ACTIVE",
  });

  const subAdminPassword = "HybridSub@123";
  await User.create({
    name: "Ayesha Rahman",
    email: "ayesha@hybridnetworks.com",
    phone: "+60 12-555 3321",
    role: "SUB_ADMIN",
    passwordHash: await hashPassword(subAdminPassword),
    status: "ACTIVE",
    createdBy: superAdmin._id,
  });

  console.log("Admin accounts seeded.");

  // ---------- Service Plans ----------
  const [maritimePlan, enterprisePlan, businessPlan] = await ServicePlan.create([
    {
      name: "Maritime Satellite Plan",
      provider: "Starlink",
      planType: "HYBRID",
      monthlyPrice: 2499,
      currency: "MYR",
      dataAllowanceGB: 500,
      voiceMinutes: 500,
      smsCount: 200,
      overageRatePerGB: 8,
      overageRatePerMin: 0.5,
      speedMbps: 220,
      sharedRatio: "1:8",
      isActive: true,
    },
    {
      name: "Enterprise Leased Line",
      provider: "Fiber",
      planType: "DATA",
      monthlyPrice: 4999,
      currency: "MYR",
      dataAllowanceGB: null,
      voiceMinutes: null,
      smsCount: null,
      overageRatePerGB: 0,
      overageRatePerMin: 0,
      speedMbps: 500,
      sharedRatio: "1:1",
      isActive: true,
    },
    {
      name: "Business Starlink Standard",
      provider: "Starlink",
      planType: "DATA",
      monthlyPrice: 1299,
      currency: "MYR",
      dataAllowanceGB: 250,
      voiceMinutes: null,
      smsCount: null,
      overageRatePerGB: 6,
      overageRatePerMin: 0,
      speedMbps: 150,
      sharedRatio: "1:4",
      isActive: true,
    },
  ]);
  console.log("Service plans seeded.");

  // ---------- Customers ----------
  const customerPassword = "Customer@123";

  type CustomerSeed = {
    name: string;
    email: string;
    phone: string;
    company: string;
    address: string;
    accountType: "BUSINESS_ENTERPRISE" | "INDIVIDUAL" | "GOVERNMENT";
    contactPerson: string;
    nidTradeLicense: string;
    customerCode: string;
    cardName: string;
    iccid: string;
    imei: string;
    service: string;
    vendor: string;
    plan: (typeof maritimePlan);
    status: "ACTIVE" | "SUSPENDED" | "INVITED";
    subStatus: "ACTIVE" | "PAUSED" | "CANCELLED";
    staticIp: string;
  };

  const customerSeeds: CustomerSeed[] = [
    {
      name: "NI-APAC Support Client",
      email: "ops@ni-apac-support.example",
      phone: "+60 3-7890 1122",
      company: "NI-APAC Support Sdn Bhd",
      address: "Suite 21-B, Bangsar South, 59200 Kuala Lumpur, Malaysia",
      accountType: "BUSINESS_ENTERPRISE",
      contactPerson: "Farid Aziz",
      nidTradeLicense: "TRAD-DNCC-008842",
      customerCode: "ZZSP100",
      cardName: "NI-APAC_SUPPORT",
      iccid: "KITP00279271",
      imei: "",
      service: "Background IP",
      vendor: "Starlink",
      plan: maritimePlan,
      status: "ACTIVE",
      subStatus: "ACTIVE",
      staticIp: "103.21.244.10",
    },
    {
      name: "Marine Horizon Logistics",
      email: "admin@marinehorizon.example",
      phone: "+60 12-778 4432",
      company: "Marine Horizon Logistics Sdn Bhd",
      address: "Port Klang Free Zone, 42920 Selangor, Malaysia",
      accountType: "BUSINESS_ENTERPRISE",
      contactPerson: "Lim Wei Chen",
      nidTradeLicense: "TRAD-PKFZ-119983",
      customerCode: "MHL220",
      cardName: "MARINE_HORIZON",
      iccid: "KITP00341982",
      imei: "356938035643809",
      service: "Priority IP",
      vendor: "Starlink",
      plan: enterprisePlan,
      status: "ACTIVE",
      subStatus: "ACTIVE",
      staticIp: "103.21.244.22",
    },
    {
      name: "Rajesh Kumar",
      email: "rajesh.kumar@example.com",
      phone: "+60 16-223 9981",
      company: "",
      address: "12 Jalan SS15/4, 47500 Subang Jaya, Selangor, Malaysia",
      accountType: "INDIVIDUAL",
      contactPerson: "Rajesh Kumar",
      nidTradeLicense: "",
      customerCode: "IND3391",
      cardName: "RAJESH_HOME",
      iccid: "KITP00298871",
      imei: "356938035112207",
      service: "Standard IP",
      vendor: "Starlink",
      plan: businessPlan,
      status: "ACTIVE",
      subStatus: "ACTIVE",
      staticIp: "",
    },
    {
      name: "Selangor District Office",
      email: "it@selangordistrict.example.gov",
      phone: "+60 3-5544 7789",
      company: "Selangor District Office",
      address: "Wisma Daerah, 40000 Shah Alam, Selangor, Malaysia",
      accountType: "GOVERNMENT",
      contactPerson: "Noraini Yusof",
      nidTradeLicense: "GOV-SEL-004471",
      customerCode: "GOV1187",
      cardName: "SEL_DISTRICT",
      iccid: "KITP00355620",
      imei: "356938035998821",
      service: "Priority IP",
      vendor: "Fiber",
      plan: enterprisePlan,
      status: "SUSPENDED",
      subStatus: "PAUSED",
      staticIp: "103.21.244.40",
    },
    {
      name: "Coral Bay Resort",
      email: "manager@coralbayresort.example",
      phone: "+60 19-887 6621",
      company: "Coral Bay Resort Sdn Bhd",
      address: "Jalan Pantai, 88000 Kota Kinabalu, Sabah, Malaysia",
      accountType: "BUSINESS_ENTERPRISE",
      contactPerson: "Aina Zulkifli",
      nidTradeLicense: "TRAD-SABAH-337712",
      customerCode: "CBR552",
      cardName: "CORAL_BAY",
      iccid: "KITP00378845",
      imei: "356938035009912",
      service: "Standard IP",
      vendor: "Starlink",
      plan: businessPlan,
      status: "INVITED",
      subStatus: "ACTIVE",
      staticIp: "",
    },
  ];

  const createdCustomers: {
    id: string;
    name: string;
    plan: typeof maritimePlan;
    status: string;
    subscriptionId: string;
  }[] = [];

  for (const seed of customerSeeds) {
    const customerId = await generateCustomerId();
    const isInvited = seed.status === "INVITED";

    const userDoc: Record<string, unknown> = {
      name: seed.name,
      email: seed.email,
      phone: seed.phone,
      role: "CUSTOMER",
      customerId,
      status: seed.status,
      address: seed.address,
      company: seed.company,
      createdBy: superAdmin._id,
      accountType: seed.accountType,
      contactPerson: seed.contactPerson,
      nidTradeLicense: seed.nidTradeLicense,
      customerCode: seed.customerCode,
      cardName: seed.cardName,
      iccid: seed.iccid,
      imei: seed.imei,
      service: seed.service,
      vendor: seed.vendor,
      network: {
        originNumber: seed.iccid,
        originCountry: "Malaysia",
        originIpAddress: seed.staticIp,
        originRegion: "APAC",
        originState: "",
        destinationNumber: "",
        destinationNetwork: "",
        destinationCountry: "",
        destinationState: "",
      },
    };

    if (isInvited) {
      const rawToken = generateRawToken();
      userDoc.inviteTokenHash = hashToken(rawToken);
      userDoc.inviteTokenExpiry = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
    } else {
      userDoc.passwordHash = await hashPassword(customerPassword);
    }

    const customer = await User.create(userDoc);

    const subscription = await Subscription.create({
      customer: customer._id,
      plan: seed.plan._id,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200),
      status: seed.subStatus,
      staticIp: seed.staticIp,
      terminalIds: [seed.iccid].filter(Boolean),
    });

    createdCustomers.push({
      id: customer._id.toString(),
      name: customer.name,
      plan: seed.plan,
      status: seed.status,
      subscriptionId: subscription._id.toString(),
    });

    // ---------- Usage records: last 6 months ----------
    for (let m = 5; m >= 0; m--) {
      const allowanceGB = seed.plan.dataAllowanceGB ?? 300;
      const usedGB = randomBetween(Math.floor(allowanceGB * 0.4), Math.floor(allowanceGB * 1.15));
      const volumeDataBytes = usedGB * GB;

      await UsageRecord.create({
        customer: customer._id,
        subscription: subscription._id,
        periodMonth: monthsAgo(m),
        volumeDataBytes,
        volumeMin: seed.plan.voiceMinutes ? randomBetween(20, seed.plan.voiceMinutes) : 0,
        volumeMsg: seed.plan.smsCount ? randomBetween(0, seed.plan.smsCount) : 0,
        volumeInBundleBytes: Math.min(volumeDataBytes, allowanceGB * GB),
        volumeOutBundleBytes: Math.max(0, volumeDataBytes - allowanceGB * GB),
        volumeTotalBytes: volumeDataBytes,
        consumptionMoney: 0,
        consumptionDataBytes: volumeDataBytes,
        consumptionMin: 0,
        consumptionMsg: 0,
        currency: "MYR",
        cdrPriceTotal: 0,
        cdrPriceInvoiced: 0,
        source: "MANUAL",
        lastUpdatedBy: superAdmin._id,
      });
    }

    await ActivityLog.create({
      actor: superAdmin._id,
      targetCustomer: customer._id,
      action: "CUSTOMER_CREATED",
      meta: { customerId },
    });
  }

  console.log("Customers, subscriptions, and usage history seeded.");

  // ---------- Invoices (mixed statuses across customers/periods) ----------
  const statusCycle: Array<"PAID" | "PAID" | "DUE" | "OVERDUE" | "SENT" | "DRAFT" | "CANCELLED"> = [
    "PAID",
    "PAID",
    "DUE",
    "OVERDUE",
    "SENT",
    "DRAFT",
    "CANCELLED",
    "PAID",
    "DUE",
    "OVERDUE",
  ];

  // Most recent period first, so a capped invoice count still guarantees the
  // current month is represented (otherwise the dashboard's "this month"
  // widgets — Monthly Revenue, Revenue Overview — render empty on a fresh seed).
  let invoiceCount = 0;
  outer: for (let m = 0; m <= 3; m++) {
    for (const c of createdCustomers) {
      if (c.status === "INVITED") continue;
      if (invoiceCount >= 16) break outer;

      const status = statusCycle[invoiceCount % statusCycle.length];
      const periodMonth = monthsAgo(m);
      const subtotal = c.plan.monthlyPrice;
      const taxRate = 6;
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;
      const issueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * (30 * m + 3));
      const dueDate = new Date(issueDate.getTime() + 1000 * 60 * 60 * 24 * 14);

      const invoiceNumber = await generateInvoiceNumber();

      await Invoice.create({
        invoiceNumber,
        customer: c.id,
        subscription: c.subscriptionId,
        periodMonth,
        issueDate,
        dueDate,
        lineItems: [
          {
            description: `${c.plan.name} — Monthly Subscription`,
            quantity: 1,
            unit: "month",
            unitPrice: subtotal,
            amount: subtotal,
          },
        ],
        subtotal,
        taxRate,
        taxLabel: "GST",
        taxAmount,
        total,
        currency: "MYR",
        status,
        // Never in the future — for the current period, dueDate - 2 days can land
        // after "now", which would make a PAID invoice look paid ahead of time.
        paidDate:
          status === "PAID"
            ? new Date(Math.min(dueDate.getTime() - 1000 * 60 * 60 * 24 * 2, Date.now() - 1000 * 60 * 60 * 24))
            : null,
        paymentMethod: status === "PAID" ? "Bank Transfer" : "",
        sentAt: status === "DRAFT" ? null : issueDate,
        createdBy: superAdmin._id,
      });

      invoiceCount++;
    }
  }
  console.log(`${invoiceCount} invoices seeded.`);

  // ---------- Support tickets ----------
  const activeCustomers = createdCustomers.filter((c) => c.status !== "INVITED");
  if (activeCustomers.length > 0) {
    const t1 = await generateTicketNumber();
    await SupportTicket.create({
      ticketNumber: t1,
      customer: activeCustomers[0].id,
      subject: "Intermittent connection drops in the evening",
      message: "We've noticed the connection drops for a few minutes around 8-9pm daily. Can you check the terminal?",
      status: "RESOLVED",
      replies: [
        {
          author: superAdmin._id,
          message: "Thanks for the report — we've identified a firmware issue on the terminal and pushed a fix.",
          createdAt: new Date(),
        },
      ],
    });

    const t2 = await generateTicketNumber();
    await SupportTicket.create({
      ticketNumber: t2,
      customer: activeCustomers[Math.min(1, activeCustomers.length - 1)].id,
      subject: "Request to increase data allowance",
      message: "We're consistently going over our monthly allowance, can we discuss upgrading our plan?",
      status: "OPEN",
      replies: [],
    });
  }
  console.log("Support tickets seeded.");

  console.log("\n=== SEED COMPLETE ===");
  console.log("Super Admin login:");
  console.log(`  Email:    admin@hybridnetworks.com`);
  console.log(`  Password: ${superAdminPassword}`);
  console.log("\nSub Admin login:");
  console.log(`  Email:    ayesha@hybridnetworks.com`);
  console.log(`  Password: ${subAdminPassword}`);
  console.log("\nSample customer logins (status ACTIVE), password for all:");
  console.log(`  Password: ${customerPassword}`);
  for (const seed of customerSeeds) {
    if (seed.status === "ACTIVE") {
      console.log(`  ${seed.email}  (${seed.customerCode})`);
    } else {
      console.log(`  ${seed.email}  (${seed.customerCode}) — status: ${seed.status}, use "Resend Invite" from admin to test onboarding`);
    }
  }
  console.log("\nDone.");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
