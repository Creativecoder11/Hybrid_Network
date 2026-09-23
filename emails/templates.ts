import { emailLayout, emailButton, escapeHtml } from "./layout";

export function inviteEmailHtml(params: {
  name: string;
  customerId?: string | null;
  actionUrl: string;
  isTeamInvite?: boolean;
}) {
  const { name, customerId, actionUrl, isTeamInvite } = params;
  const idLine = customerId
    ? `<p style="margin:0 0 4px;color:#9CA3AF;">Your Customer ID</p>
       <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#4ADE80;">${escapeHtml(customerId)}</p>`
    : "";

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;color:#F9FAFB;">Your Hybrid Networks account is ready</p>
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
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
    <p style="margin:0 0 16px;">Hi ${escapeHtml(params.name)},</p>
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
  portalUrl?: string;
}) {
  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;color:#F9FAFB;">Invoice ${params.invoiceNumber}</p>
    <p style="margin:0 0 16px;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin:0 0 16px;">
      Your invoice <strong>${params.invoiceNumber}</strong> for <strong>${params.amount}</strong>
      is now available. Payment is due by <strong>${params.dueDate}</strong>.
    </p>
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
  portalUrl?: string;
}) {
  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;color:#F9FAFB;">Payment reminder: ${params.invoiceNumber}</p>
    <p style="margin:0 0 16px;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin:0 0 16px;">
      This is a friendly reminder that invoice <strong>${params.invoiceNumber}</strong> for
      <strong>${params.amount}</strong> was due on <strong>${params.dueDate}</strong> and remains unpaid.
    </p>
  `);
}

export function temporaryCredentialsEmailHtml(params: {
  name: string;
  companyName?: string | null;
  customerId?: string | null;
  email: string;
  temporaryPassword: string;
  portalUrl: string;
  expiresAt: string;
  accountNumbers?: string[];
}) {
  const { name, companyName, customerId, email, temporaryPassword, portalUrl, expiresAt, accountNumbers = [] } = params;
  const box = (label: string, value: string, valueStyle: string) =>
    `<div style="margin:0 0 12px;padding:12px 16px;background-color:#1F2937;border-radius:8px;border:1px solid #374151;">
       <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
       <p style="margin:0;${valueStyle}">${value}</p>
     </div>`;

  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#F9FAFB;">You're invited to the Hybrid Networks Customer Portal</p>
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;">
      A portal login has been created for you${companyName ? ` on behalf of <strong>${escapeHtml(companyName)}</strong>` : ""}.
      Sign in with the temporary password below to view your devices, usage, plans and bills.
    </p>

    <div style="margin:20px 0;padding:16px 16px 4px;background-color:#111827;border-radius:8px;border:1px solid #374151;">
      ${customerId ? box("Customer ID", escapeHtml(customerId), "font-size:16px;font-weight:700;color:#4ADE80;font-family:monospace;") : ""}
      ${accountNumbers.length > 0 ? box(accountNumbers.length === 1 ? "Customer Account" : "Customer Accounts", accountNumbers.map(escapeHtml).join(", "), "font-size:15px;font-weight:600;color:#F9FAFB;font-family:monospace;") : ""}
      ${box("Login Email", escapeHtml(email), "font-size:15px;font-weight:600;color:#F9FAFB;")}
      ${box("Temporary Password", escapeHtml(temporaryPassword), "font-size:18px;font-weight:700;color:#F59E0B;font-family:monospace;letter-spacing:1px;")}
    </div>

    ${emailButton("Sign In to the Portal", portalUrl)}

    <p style="margin:20px 0 8px;font-size:14px;font-weight:600;color:#F9FAFB;">What happens next</p>
    <ol style="margin:0 0 16px;padding-left:20px;color:#D1D5DB;font-size:13px;line-height:1.6;">
      <li>Sign in with your email and the temporary password.</li>
      <li>You'll be asked to choose a new, permanent password straight away.</li>
      <li>You'll then land on your customer dashboard.</li>
    </ol>

    <p style="margin:16px 0 0;color:#9CA3AF;font-size:13px;">
      This temporary password expires on <strong>${escapeHtml(expiresAt)}</strong>. If it expires, ask your
      administrator to re-send the invitation. Never share this password with anyone.
    </p>
  `);
}

export function unallocatedCdrAlertEmailHtml(params: {
  fileName: string;
  uploadedBy: string;
  totalRows: number;
  allocatedRows: number;
  unallocatedRows: number;
  reasons: { label: string; count: number }[];
  reportUrl: string;
}) {
  const reasonRows = params.reasons
    .map(
      (r) =>
        `<tr><td style="padding:4px 0;color:#D1D5DB;">${escapeHtml(r.label)}</td><td style="padding:4px 0;text-align:right;color:#F59E0B;font-weight:700;">${r.count}</td></tr>`
    )
    .join("");
  return emailLayout(`
    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#F59E0B;">Unallocated CDR records found</p>
    <p style="margin:0 0 16px;">
      <strong>${params.unallocatedRows}</strong> of ${params.totalRows} record(s) in
      <strong>${escapeHtml(params.fileName)}</strong> (uploaded by ${escapeHtml(params.uploadedBy)}) could not be allocated
      to a Customer Account and Product Code. ${params.allocatedRows} record(s) were allocated normally.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:13px;">${reasonRows}</table>
    <p style="margin:0 0 16px;color:#9CA3AF;font-size:13px;">
      No customers or accounts were created automatically. Add the missing Customer Account or Product Code, then
      reprocess the upload from the report.
    </p>
    ${emailButton("View Report", params.reportUrl)}
  `);
}

export function slashWriteOperationEmailHtml(params: {
  operation: string;
  apiName: string;
  status: string;
  occurredAt: string;
  initiatedBy: string;
  customerName?: string | null;
  accountNumber?: string | null;
  slashAccountNumber?: string | null;
  serviceLineNumber?: string | null;
  deviceId?: string | null;
  kitSerialNumber?: string | null;
  product?: string | null;
  reference?: string | null;
}) {
  const rows: [string, string | null | undefined][] = [
    ["Operation", params.operation],
    ["API action", params.apiName],
    ["Result", params.status],
    ["Date / time (UTC)", params.occurredAt],
    ["Hybrid Networks customer", params.customerName],
    ["Customer Account Number", params.accountNumber],
    ["Starlink account number", params.slashAccountNumber],
    ["Service line", params.serviceLineNumber],
    ["Device / terminal ID", params.deviceId],
    ["KIT serial number", params.kitSerialNumber],
    ["Product / service", params.product],
    ["API reference", params.reference],
    ["Initiated by", params.initiatedBy],
  ];
  const table = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#9CA3AF;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:6px 0;color:#F9FAFB;font-family:monospace;">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  return emailLayout(`
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#F9FAFB;">SLASH WRITE operation performed</p>
    <p style="margin:0 0 16px;">
      Automated notice from the Hybrid Networks portal: the following WRITE operation was submitted to the SLASH
      Starlink passthrough API and accepted.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;">${table}</table>
  `);
}
