import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  return transporter;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const t = getTransporter();

  if (!t) {
    const linkMatch = options.html.match(/href="([^"]+)"/);
    console.log(
      `\n[email:dev-mode] SMTP not configured — would send "${options.subject}" to ${options.to}` +
        (linkMatch ? `\n[email:dev-mode] Link: ${linkMatch[1]}\n` : "\n")
    );
    return { delivered: false, devMode: true };
  }

  await t.sendMail({
    from: process.env.EMAIL_FROM || "Hybrid Networks <billing@hybridnetworks.com>",
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  });

  return { delivered: true, devMode: false };
}

/**
 * Admin-facing explanation of a failed send, without credentials or raw
 * server output. The full error should still be logged server-side.
 */
export function describeMailError(err: unknown): string {
  const e = (err ?? {}) as { code?: string; responseCode?: number; command?: string };
  if (e.code === "EAUTH") return "The email server rejected the SMTP username or password (SMTP_USER / SMTP_PASS).";
  if (e.code === "ECONNECTION" || e.code === "ETIMEDOUT" || e.code === "ESOCKET" || e.code === "EDNS") {
    return "Couldn't connect to the email server. Check SMTP_HOST and SMTP_PORT.";
  }
  if (e.code === "EENVELOPE" || e.command === "MAIL FROM" || e.responseCode === 553) {
    return "The email server refused the sender address. EMAIL_FROM must be a mailbox the SMTP account is allowed to send as.";
  }
  if (e.command === "RCPT TO" || e.responseCode === 550) {
    return "The email server refused the customer's email address.";
  }
  return "The email server couldn't send the message. Check the server logs for details.";
}
