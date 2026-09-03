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

export function temporaryCredentialsEmailHtml(params: {
  name: string;
  customerId?: string | null;
  email: string;
  temporaryPassword: string;
  portalUrl: string;
}) {
  const { name, customerId, email, temporaryPassword, portalUrl } = params;
  const idLine = customerId
    ? `<div style="margin:0 0 12px;padding:12px 16px;background-color:#1F2937;border-radius:8px;border:1px solid #374151;">
         <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Customer ID</p>
         <p style="margin:0;font-size:16px;font-weight:700;color:#4ADE80;font-family:monospace;">${customerId}</p>
       </div>`
    : "";

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#F9FAFB;">Your Hybrid Networks Portal Login Details</p>
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">
      Your account on the Hybrid Networks Customer Portal is ready. You can log in using your temporary credentials below to view your usage, devices, billing, and invoices.
    </p>

    <div style="margin:20px 0;padding:16px;background-color:#111827;border-radius:8px;border:1px solid #374151;">
      ${idLine}
      <div style="margin:0 0 12px;padding:12px 16px;background-color:#1F2937;border-radius:8px;border:1px solid #374151;">
        <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Login Email</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#F9FAFB;">${email}</p>
      </div>
      <div style="margin:0;padding:12px 16px;background-color:#1F2937;border-radius:8px;border:1px solid #374151;">
        <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Temporary Password</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#F59E0B;font-family:monospace;letter-spacing:1px;">${temporaryPassword}</p>
      </div>
    </div>

    ${emailButton("Log In to Portal", portalUrl)}

    <p style="margin:20px 0 8px;font-size:14px;font-weight:600;color:#F9FAFB;">Next Steps:</p>
    <ol style="margin:0 0 16px;padding-left:20px;color:#D1D5DB;font-size:13px;line-height:1.6;">
      <li>Log in with your temporary password.</li>
      <li>Go to <strong>Profile</strong> in the portal navigation.</li>
      <li>Update your password to a new permanent password of your choice.</li>
    </ol>

    <p style="margin:16px 0 0;color:#9CA3AF;font-size:13px;">
      For your security, please do not share this temporary password with anyone.
    </p>
  `);
}
