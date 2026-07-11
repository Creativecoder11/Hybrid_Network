import "server-only";
import { SupportTicket } from "@/models/SupportTicket";
import type { TicketStats } from "@/lib/types/support";

export async function getSupportTicketStats(): Promise<TicketStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

  const [
    openCount,
    openedTodayCount,
    inProgressCount,
    inProgressAgents,
    resolvedTodayCount,
    resolvedYesterdayCount,
    closedCount,
    totalCount,
  ] = await Promise.all([
    SupportTicket.countDocuments({ status: "OPEN" }),
    SupportTicket.countDocuments({ createdAt: { $gte: startOfToday } }),
    SupportTicket.countDocuments({ status: "IN_PROGRESS" }),
    SupportTicket.distinct("assignedTo", { status: "IN_PROGRESS", assignedTo: { $ne: null } }),
    SupportTicket.countDocuments({ status: "RESOLVED", resolvedAt: { $gte: startOfToday } }),
    SupportTicket.countDocuments({
      status: "RESOLVED",
      resolvedAt: { $gte: startOfYesterday, $lt: startOfToday },
    }),
    SupportTicket.countDocuments({ status: "CLOSED" }),
    SupportTicket.countDocuments({}),
  ]);

  return {
    openCount,
    openedTodayCount,
    inProgressCount,
    inProgressAgentCount: inProgressAgents.length,
    resolvedTodayCount,
    resolvedTodayDelta: resolvedTodayCount - resolvedYesterdayCount,
    closedCount,
    closedRate: totalCount > 0 ? (closedCount / totalCount) * 100 : 0,
  };
}
