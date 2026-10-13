import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { getSupportNotifications } from "@/lib/support/unread";

// Polled by the admin shell (components/admin/AdminShell.tsx) so the Support
// badge and the bell update without a page reload.
export async function GET() {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  const support = await getSupportNotifications();
  return NextResponse.json({ support }, { headers: { "Cache-Control": "private, no-store" } });
}
