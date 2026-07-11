import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { connectDB } from "@/lib/db/connect";
import { SupportTicket } from "@/models/SupportTicket";
import { TicketThread } from "@/components/support/TicketThread";
import { AdminTicketStatusControl } from "@/components/admin/AdminTicketStatusControl";
import type { TicketDetail } from "@/lib/types/support";

export const metadata: Metadata = {
  title: "Support Ticket | Hybrid Networks Admin",
};

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectDB();
  const ticket = await SupportTicket.findById(id).populate("customer").populate("replies.author").lean();
  if (!ticket) notFound();

  const customer = ticket.customer as unknown as { _id: string; name: string } | null;

  const detail: TicketDetail = {
    id: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber,
    customerId: customer?._id?.toString() ?? "",
    customerName: customer?.name ?? "Unknown",
    subject: ticket.subject,
    status: ticket.status,
    message: ticket.message,
    replyCount: ticket.replies.length,
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
        href="/admin/support"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to Support
      </Link>
      <TicketThread
        ticket={detail}
        headerExtra={<AdminTicketStatusControl ticketId={detail.id} status={detail.status} />}
      />
    </div>
  );
}
