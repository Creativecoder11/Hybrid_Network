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
