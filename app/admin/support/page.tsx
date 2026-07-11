import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { SupportTicket } from "@/models/SupportTicket";
import { AdminSupportClient } from "@/components/admin/AdminSupportClient";
import type { TicketRow } from "@/lib/types/support";

export const metadata: Metadata = {
  title: "Support | Hybrid Networks Admin",
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "ALL";

  await connectDB();
  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;

  const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 }).populate("customer").lean();

  const rows: TicketRow[] = tickets.map((t) => {
    const customer = t.customer as unknown as { _id: string; name: string } | null;
    return {
      id: t._id.toString(),
      ticketNumber: t.ticketNumber,
      customerId: customer?._id?.toString() ?? "",
      customerName: customer?.name ?? "Unknown",
      subject: t.subject,
      status: t.status,
      replyCount: t.replies?.length ?? 0,
      createdAt: (t.createdAt as Date | undefined)?.toISOString() ?? "",
      updatedAt: (t.updatedAt as Date | undefined)?.toISOString() ?? "",
    };
  });

  return <AdminSupportClient tickets={rows} status={status} />;
}
