export function emailLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0B0F14;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0F14;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#161B22;border:1px solid #232A33;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #232A33;">
                <span style="color:#4ADE80;font-size:20px;font-weight:800;letter-spacing:0.5px;">HYBRID NETWORKS</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#E5E7EB;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #232A33;color:#6B7280;font-size:12px;">
                Hybrid Networks &middot; This is an automated message, please do not reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:10px;background-color:#3B82F6;">
        <a href="${url}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${label}</a>
      </td>
    </tr>
  </table>`;
}
