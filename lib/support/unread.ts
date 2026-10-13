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

/** A ticket waiting on the admin: newly opened, or the customer replied. */
export type UnreadTicketNotice = {
  id: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  /** True when the customer replied to an existing ticket rather than opening it. */
  isReply: boolean;
  updatedAt: string;
};

export type SupportNotifications = { unreadCount: number; tickets: UnreadTicketNotice[] };

/** Unread count plus the most recently active unread tickets, for the admin bell. */
export async function getSupportNotifications(limit = 8): Promise<SupportNotifications> {
  await connectDB();
  const [unreadCount, tickets] = await Promise.all([
    SupportTicket.countDocuments({ adminUnread: true }),
    SupportTicket.find({ adminUnread: true })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("ticketNumber subject customer replies updatedAt")
      .populate("customer", "name company")
      .lean(),
  ]);
  return {
    unreadCount,
    tickets: tickets.map((t) => {
      const customer = t.customer as unknown as { name?: string; company?: string } | null;
      return {
        id: t._id.toString(),
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        customerName: customer?.company || customer?.name || "Customer",
        isReply: (t.replies?.length ?? 0) > 0,
        updatedAt: (t.updatedAt as Date | undefined)?.toISOString() ?? "",
      };
    }),
  };
}

export async function getCustomerUnreadTicketCount(customerProfileId: string): Promise<number> {
  await connectDB();
  return SupportTicket.countDocuments({ customer: customerProfileId, customerUnread: true });
}

export async function markTicketCustomerRead(ticketId: string, customerProfileId: string): Promise<void> {
  await connectDB();
  await SupportTicket.updateOne(
    { _id: ticketId, customer: customerProfileId, customerUnread: true },
    { $set: { customerUnread: false } }
  );
}

export type CustomerUnreadTicketNotice = {
  id: string;
  ticketNumber: string;
  subject: string;
  isReply: boolean;
  updatedAt: string;
};

export type CustomerSupportNotifications = {
  unreadCount: number;
  tickets: CustomerUnreadTicketNotice[];
};

/** Unread count plus active unread tickets for a customer portal account. */
export async function getCustomerSupportNotifications(
  customerProfileId: string,
  limit = 8
): Promise<CustomerSupportNotifications> {
  await connectDB();
  const [unreadCount, tickets] = await Promise.all([
    SupportTicket.countDocuments({ customer: customerProfileId, customerUnread: true }),
    SupportTicket.find({ customer: customerProfileId, customerUnread: true })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("ticketNumber subject replies updatedAt")
      .lean(),
  ]);

  return {
    unreadCount,
    tickets: tickets.map((t) => ({
      id: t._id.toString(),
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      isReply: (t.replies?.length ?? 0) > 0,
      updatedAt: (t.updatedAt as Date | undefined)?.toISOString() ?? "",
    })),
  };
}
