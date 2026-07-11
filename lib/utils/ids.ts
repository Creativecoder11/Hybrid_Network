import "server-only";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { SupportTicket } from "@/models/SupportTicket";
import { Settings } from "@/models/Settings";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

export async function generateCustomerId(): Promise<string> {
  await connectDB();
  for (let attempt = 0; attempt < 10; attempt++) {
    const count = await User.countDocuments({ role: "CUSTOMER" });
    const sequential = (count + 1 + attempt).toString().padStart(4, "0");
    const suffix = randomDigits(1);
    const candidate = `HN-CUST-${sequential}${suffix}`;
    const exists = await User.exists({ customerId: candidate });
    if (!exists) return candidate;
  }
  return `HN-CUST-${Date.now().toString().slice(-5)}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  await connectDB();
  const settings = await Settings.findOneAndUpdate(
    { key: "GLOBAL" },
    { $inc: { invoiceNextNumber: 1 }, $setOnInsert: { key: "GLOBAL" } },
    { upsert: true, returnDocument: "before" }
  );
  const prefix = settings?.invoicePrefix || "HINV";
  const nextNumber = settings?.invoiceNextNumber ?? 1001;
  return `${prefix}-${nextNumber}`;
}

export async function generateTicketNumber(): Promise<string> {
  await connectDB();
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `TCK-${randomDigits(4)}`;
    const exists = await SupportTicket.exists({ ticketNumber: candidate });
    if (!exists) return candidate;
  }
  return `TCK-${Date.now().toString().slice(-6)}`;
}
