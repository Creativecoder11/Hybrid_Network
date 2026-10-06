"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { SupportTicket } from "@/models/SupportTicket";
import { ActivityLog } from "@/models/ActivityLog";
import { User, CUSTOMER_PROFILE_FILTER } from "@/models/User";
import { sendMail } from "@/lib/email/mailer";
import { adminTicketOpenedEmailHtml } from "@/emails/templates";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { generateTicketNumber } from "@/lib/utils/ids";
import {
  adminCreateTicketSchema,
  createTicketSchema,
  replyTicketSchema,
  updateTicketStatusSchema,
  assignTicketSchema,
} from "@/lib/validations/ticket";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createTicketAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getAuthorizedUser(["CUSTOMER"]);
  if (!user) return { error: "You're not authorized to perform this action." };

  const parsed = createTicketSchema.safeParse({
    subject: str(formData, "subject"),
    message: str(formData, "message"),
    category: str(formData, "category") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const ticketNumber = await generateTicketNumber();

  // Tickets belong to the Customer Profile, so every portal user of the same
  // company sees them.
  const customerId = user.customerProfileId ?? user.id;
  await SupportTicket.create({
    ticketNumber,
    customer: customerId,
    openedBy: user.id,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: parsed.data.category,
    status: "OPEN",
  });

  await ActivityLog.create({
    actor: user.id,
    targetCustomer: customerId,
    action: "TICKET_CREATED",
    meta: { ticketNumber },
  });

  revalidatePath("/portal/support");
  revalidatePath("/admin/support");
  return { success: `Ticket ${ticketNumber} submitted. We'll get back to you soon.` };
}

/**
 * Admin opens a ticket on a Customer Profile's behalf. It shows up in the
 * portal for every user of that profile, who can reply to it like any other.
 */
export async function adminCreateTicketAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = adminCreateTicketSchema.safeParse({
    customerId: str(formData, "customerId"),
    subject: str(formData, "subject"),
    message: str(formData, "message"),
    category: str(formData, "category") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  if (!isValidObjectId(parsed.data.customerId)) return { error: "Customer not found." };
  const customer = await User.findOne({ _id: parsed.data.customerId, ...CUSTOMER_PROFILE_FILTER })
    .select("name email status")
    .lean();
  if (!customer) return { error: "Customer not found." };

  const ticketNumber = await generateTicketNumber();
  const ticket = await SupportTicket.create({
    ticketNumber,
    customer: customer._id,
    openedBy: admin.id,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: parsed.data.category,
    status: "OPEN",
    // The admin wrote it, so there is nothing new for the admin side to read.
    adminUnread: false,
    assignedTo: admin.id,
  });

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: customer._id,
    action: "TICKET_CREATED",
    meta: { ticketNumber, openedByAdmin: true },
  });

  // Best-effort notification; the ticket is already visible in the portal.
  if (customer.status !== "SUSPENDED") {
    try {
      const portalUrl = `${process.env.CUSTOMER_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal/support/${ticket._id.toString()}`;
      await sendMail({
        to: customer.email,
        subject: `Support ticket ${ticketNumber}: ${parsed.data.subject}`,
        html: adminTicketOpenedEmailHtml({
          name: customer.name,
          ticketNumber,
          subject: parsed.data.subject,
          message: parsed.data.message,
          portalUrl,
        }),
      });
    } catch (err) {
      console.error("[support] failed to email customer about new ticket", err);
    }
  }

  revalidatePath("/portal/support");
  revalidatePath("/admin/support");
  revalidatePath(`/admin/customers/${customer._id.toString()}`);
  return { success: `Ticket ${ticketNumber} created for ${customer.name}.` };
}

export async function replyTicketAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN", "CUSTOMER"]);
  if (!user) return { error: "You're not authorized to perform this action." };

  const parsed = replyTicketSchema.safeParse({
    ticketId: str(formData, "ticketId"),
    message: str(formData, "message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Reply cannot be empty." };
  }

  await connectDB();
  const ticket = await SupportTicket.findById(parsed.data.ticketId);
  if (!ticket) return { error: "Ticket not found." };
  if (user.role === "CUSTOMER" && ticket.customer.toString() !== user.customerProfileId) {
    return { error: "You're not authorized to reply to this ticket." };
  }

  ticket.replies.push({ author: user.id, message: parsed.data.message, createdAt: new Date() });
  if (user.role === "CUSTOMER") {
    if (ticket.status === "RESOLVED") ticket.status = "OPEN";
    ticket.adminUnread = true;
  } else {
    if (ticket.status === "OPEN") ticket.status = "IN_PROGRESS";
    ticket.adminUnread = false;
  }
  await ticket.save();

  await ActivityLog.create({
    actor: user.id,
    targetCustomer: ticket.customer,
    action: "TICKET_REPLIED",
    meta: { ticketNumber: ticket.ticketNumber },
  });

  revalidatePath(`/portal/support/${parsed.data.ticketId}`);
  revalidatePath(`/admin/support/${parsed.data.ticketId}`);
  revalidatePath("/portal/support");
  revalidatePath("/admin/support");
  return { success: "Reply sent." };
}

export async function updateTicketStatusAction(
  ticketId: string,
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = updateTicketStatusSchema.safeParse({ ticketId, status });
  if (!parsed.success) return { error: "Invalid status." };

  await connectDB();
  const ticket = await SupportTicket.findByIdAndUpdate(
    ticketId,
    { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
    { new: true }
  );
  if (!ticket) return { error: "Ticket not found." };

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: ticket.customer,
    action: "TICKET_STATUS_CHANGED",
    meta: { ticketNumber: ticket.ticketNumber, status },
  });

  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { success: "Status updated." };
}

export async function assignTicketAction(
  ticketId: string,
  assignedTo: string | null
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  const parsed = assignTicketSchema.safeParse({ ticketId, assignedTo });
  if (!parsed.success) return { error: "Invalid assignment." };

  await connectDB();
  const ticket = await SupportTicket.findByIdAndUpdate(
    ticketId,
    { assignedTo: parsed.data.assignedTo || null },
    { new: true }
  );
  if (!ticket) return { error: "Ticket not found." };

  await ActivityLog.create({
    actor: admin.id,
    targetCustomer: ticket.customer,
    action: "TICKET_ASSIGNED",
    meta: { ticketNumber: ticket.ticketNumber, assignedTo: parsed.data.assignedTo || "unassigned" },
  });

  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { success: "Ticket assigned." };
}
