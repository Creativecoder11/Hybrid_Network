import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { SupportTicket } from "@/models/SupportTicket";
import { requireRole } from "@/lib/auth/dal";
import { PortalSupportClient } from "@/components/portal/PortalSupportClient";
import type { TicketRow } from "@/lib/types/support";

export const metadata: Metadata = {
  title: "Support | Hybrid Networks Portal",
};

export default async function PortalSupportPage() {
  const user = await requireRole(["CUSTOMER"], "/admin");

  await connectDB();
  const tickets = await SupportTicket.find({ customer: user.id }).sort({ createdAt: -1 }).lean();

  const rows: TicketRow[] = tickets.map((t) => ({
    id: t._id.toString(),
    ticketNumber: t.ticketNumber,
    customerId: user.id,
    customerName: user.name,
    customerCode: "",
    category: t.category ?? "GENERAL",
    subject: t.subject,
    status: t.status,
    replyCount: t.replies?.length ?? 0,
    assignedToId: "",
    assignedToName: "",
    createdAt: (t.createdAt as Date | undefined)?.toISOString() ?? "",
    updatedAt: (t.updatedAt as Date | undefined)?.toISOString() ?? "",
  }));

  return <PortalSupportClient tickets={rows} />;
}
