// Support ticket priority: set by admins (customers' tickets start at NORMAL).
// Tickets created before this field existed have none and read as NORMAL.

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_TONE: Record<TicketPriority, "neutral" | "blue" | "amber" | "red"> = {
  LOW: "neutral",
  NORMAL: "blue",
  HIGH: "amber",
  URGENT: "red",
};

export function ticketPriority(value: string | null | undefined): TicketPriority {
  return (TICKET_PRIORITIES as readonly string[]).includes(value ?? "") ? (value as TicketPriority) : "NORMAL";
}
