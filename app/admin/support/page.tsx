import type { Metadata } from "next";
import { connectDB } from "@/lib/db/connect";
import { SupportTicket } from "@/models/SupportTicket";
import { User } from "@/models/User";
import { getSupportTicketStats } from "@/lib/support/ticketStats";
import { AdminSupportClient } from "@/components/admin/AdminSupportClient";
import type { AgentOption, TicketRow } from "@/lib/types/support";

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
  const q = typeof sp.q === "string" ? sp.q : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "date_desc";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = Math.max(1, Number(sp.pageSize) || 10);

  await connectDB();
  const filter: Record<string, unknown> = {};
  if (status !== "ALL") filter.status = status;

  const sortSpec: Record<string, 1 | -1> =
    sort === "date_asc" ? { createdAt: 1 } : { createdAt: -1 };

  const [tickets, stats, agents] = await Promise.all([
    SupportTicket.find(filter)
      .sort(sortSpec)
      .populate("customer")
      .populate("assignedTo")
      .lean(),
    getSupportTicketStats(),
    User.find({ role: { $in: ["SUPER_ADMIN", "SUB_ADMIN"] } }).sort({ name: 1 }).lean(),
  ]);

  let rows: TicketRow[] = tickets.map((t) => {
    const customer = t.customer as unknown as { _id: string; name: string; customerCode?: string } | null;
    const assignee = t.assignedTo as unknown as { _id: string; name: string } | null;
    return {
      id: t._id.toString(),
      ticketNumber: t.ticketNumber,
      customerId: customer?._id?.toString() ?? "",
      customerName: customer?.name ?? "Unknown",
      customerCode: customer?.customerCode ?? "",
      category: t.category ?? "GENERAL",
      subject: t.subject,
      status: t.status,
      replyCount: t.replies?.length ?? 0,
      assignedToId: assignee?._id?.toString() ?? "",
      assignedToName: assignee?.name ?? "",
      createdAt: (t.createdAt as Date | undefined)?.toISOString() ?? "",
      updatedAt: (t.updatedAt as Date | undefined)?.toISOString() ?? "",
    };
  });

  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.ticketNumber.toLowerCase().includes(needle) ||
        r.subject.toLowerCase().includes(needle) ||
        r.customerName.toLowerCase().includes(needle) ||
        r.customerCode.toLowerCase().includes(needle)
    );
  }

  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  const agentOptions: AgentOption[] = agents.map((a) => ({ id: a._id.toString(), name: a.name }));

  return (
    <AdminSupportClient
      tickets={paged}
      total={total}
      page={page}
      pageSize={pageSize}
      status={status}
      q={q}
      sort={sort}
      stats={stats}
      agents={agentOptions}
    />
  );
}
