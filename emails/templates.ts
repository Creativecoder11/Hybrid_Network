import { emailLayout, emailButton } from "./layout";

export function inviteEmailHtml(params: {
  name: string;
  customerId?: string | null;
  actionUrl: string;
  isTeamInvite?: boolean;
}) {
  const { name, customerId, actionUrl, isTeamInvite } = params;
  const idLine = customerId
    ? `<p style="margin:0 0 4px;color:#9CA3AF;">Your Customer ID</p>
       <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#4ADE80;">${customerId}</p>`
    : "";

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;color:#F9FAFB;">Your Hybrid Networks account is ready</p>
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">
      ${
        isTeamInvite
          ? "An administrator account has been created for you on the Hybrid Networks Portal."
          : "Your account with Hybrid Networks has been created."
      }
      Set a password to activate it and sign in.
    </p>
    ${idLine}
    ${emailButton("Set Your Password", actionUrl)}
    <p style="margin:16px 0 0;color:#9CA3AF;font-size:13px;">
      This link expires in 72 hours. If you did not expect this email, you can safely ignore it.
    </p>
  `);
}

export function passwordResetEmailHtml(params: { name: string; actionUrl: string }) {
  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;color:#F9FAFB;">Reset your password</p>
    <p style="margin:0 0 16px;">Hi ${params.name},</p>
    <p style="margin:0 0 16px;">We received a request to reset your Hybrid Networks account password.</p>
    ${emailButton("Reset Password", params.actionUrl)}
    <p style="margin:16px 0 0;color:#9CA3AF;font-size:13px;">
      This link expires in 1 hour. If you did not request this, you can safely ignore this email.
    </p>
  `);
}

export function invoiceEmailHtml(params: {
  name: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  portalUrl: string;
}) {
  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;color:#F9FAFB;">Invoice ${params.invoiceNumber}</p>
    <p style="margin:0 0 16px;">Hi ${params.name},</p>
    <p style="margin:0 0 16px;">
      Your invoice <strong>${params.invoiceNumber}</strong> for <strong>${params.amount}</strong>
      is now available. Payment is due by <strong>${params.dueDate}</strong>.
    </p>
    ${emailButton("View Invoice", params.portalUrl)}
    <p style="margin:16px 0 0;color:#9CA3AF;font-size:13px;">
      A PDF copy of this invoice is attached to this email.
    </p>
  `);
}

export function invoiceReminderEmailHtml(params: {
  name: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  portalUrl: string;
}) {
  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;color:#F9FAFB;">Payment reminder: ${params.invoiceNumber}</p>
    <p style="margin:0 0 16px;">Hi ${params.name},</p>
    <p style="margin:0 0 16px;">
      This is a friendly reminder that invoice <strong>${params.invoiceNumber}</strong> for
      <strong>${params.amount}</strong> was due on <strong>${params.dueDate}</strong> and remains unpaid.
    </p>
    ${emailButton("View & Pay Invoice", params.portalUrl)}
  `);
}
