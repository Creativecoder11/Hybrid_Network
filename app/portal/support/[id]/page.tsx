import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { connectDB } from "@/lib/db/connect";
import { SupportTicket } from "@/models/SupportTicket";
import { requireRole } from "@/lib/auth/dal";
import { TicketThread } from "@/components/support/TicketThread";
import type { TicketDetail } from "@/lib/types/support";

export const metadata: Metadata = {
  title: "Support Ticket | Hybrid Networks Portal",
};

export default async function PortalTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["CUSTOMER"], "/admin");
  const { id } = await params;

  await connectDB();
  const ticket = await SupportTicket.findById(id).populate("replies.author").lean();
  if (!ticket || ticket.customer.toString() !== user.id) notFound();

  const detail: TicketDetail = {
    id: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber,
    customerId: user.id,
    customerName: user.name,
    customerCode: "",
    category: ticket.category ?? "GENERAL",
    subject: ticket.subject,
    status: ticket.status,
    message: ticket.message,
    replyCount: ticket.replies.length,
    assignedToId: "",
    assignedToName: "",
    createdAt: (ticket.createdAt as Date | undefined)?.toISOString() ?? "",
    updatedAt: (ticket.updatedAt as Date | undefined)?.toISOString() ?? "",
    replies: ticket.replies.map((r) => {
      const author = r.author as unknown as { name: string; role: string } | null;
      return {
        authorName: author?.name ?? "Unknown",
        isAdmin: author?.role !== "CUSTOMER",
        message: r.message,
        createdAt: (r.createdAt as Date | undefined)?.toISOString() ?? "",
      };
    }),
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/portal/support"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to Support
      </Link>
      <TicketThread ticket={detail} />
    </div>
  );
}
