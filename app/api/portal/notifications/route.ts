import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { getCustomerSupportNotifications } from "@/lib/support/unread";
import { getPortalContext } from "@/lib/accounts/access";
import { listTerminalAlerts, type EnrichedAlert } from "@/lib/terminals/alerts";

// Polled by the customer portal shell (components/portal/PortalShell.tsx) so
// the Support badge, device alerts, and notification bell update live without a page reload.
export async function GET() {
  const user = await getAuthorizedUser(["CUSTOMER"]);
  if (!user || !user.customerProfileId) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  const support = await getCustomerSupportNotifications(user.customerProfileId);

  let alerts: EnrichedAlert[] = [];
  try {
    const ctx = await getPortalContext();
    if (ctx.accounts.length > 0) {
      alerts = await listTerminalAlerts({ accountIds: ctx.accounts.map((a) => a.id) });
    }
  } catch (err) {
    console.error("[portal/notifications] failed to load device alerts:", err);
  }

  return NextResponse.json({ support, alerts }, { headers: { "Cache-Control": "private, no-store" } });
}

