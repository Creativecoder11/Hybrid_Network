import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { getCustomerSupportNotifications } from "@/lib/support/unread";

// Polled by the customer portal shell (components/portal/PortalShell.tsx) so
// the Support badge and notification bell update live without a page reload.
export async function GET() {
  const user = await getAuthorizedUser(["CUSTOMER"]);
  if (!user || !user.customerProfileId) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  const support = await getCustomerSupportNotifications(user.customerProfileId);
  return NextResponse.json({ support }, { headers: { "Cache-Control": "private, no-store" } });
}

