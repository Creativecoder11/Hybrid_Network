import "server-only";
import { connectDB } from "@/lib/db/connect";
import { SupportTicket } from "@/models/SupportTicket";

export async function getUnreadTicketCount(): Promise<number> {
  await connectDB();
  return SupportTicket.countDocuments({ adminUnread: true });
}

export async function markTicketRead(ticketId: string): Promise<void> {
  await connectDB();
  await SupportTicket.updateOne({ _id: ticketId, adminUnread: true }, { $set: { adminUnread: false } });
}
