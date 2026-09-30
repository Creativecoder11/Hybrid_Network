export type TicketRow = {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  category: "BILLING" | "TECHNICAL" | "SERVICE" | "GENERAL";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  replyCount: number;
  assignedToId: string;
  assignedToName: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentOption = { id: string; name: string };

/** Customer Profile choice for the admin "Create Ticket" form. */
export type TicketCustomerOption = {
  id: string;
  name: string;
  company: string;
  customerId: string;
  email: string;
  accountNumbers: string[];
};

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
