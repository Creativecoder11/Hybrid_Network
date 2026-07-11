export type TicketRow = {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  replyCount: number;
  createdAt: string;
  updatedAt: string;
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
