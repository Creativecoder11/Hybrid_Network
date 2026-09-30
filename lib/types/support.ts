export type TicketRow = {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  category: "BILLING" | "TECHNICAL" | "SERVICE" | "GENERAL";
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  replyCount: number;
  assignedToId: string;
  assignedToName: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentOption = { id: string; name: string };

export type TicketStats = {
  openCount: number;
  openedTodayCount: number;
  inProgressCount: number;
  inProgressAgentCount: number;
  resolvedTodayCount: number;
  resolvedTodayDelta: number;
  closedCount: number;
  closedRate: number;
};

export type TicketReply = {
  authorName: string;
  isAdmin: boolean;
  message: string;
  createdAt: string;
};

export type TicketDetail = TicketRow & {
  message: string;
  replies: TicketReply[];
};
