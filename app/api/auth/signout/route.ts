import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/lib/auth/session";

// Clears a session cookie whose account is no longer usable (suspended,
// deleted, or removed from its Customer Profile) and sends the browser to the
// login page. Pages redirect here via requireUser() — see lib/auth/dal.ts.
export async function GET(request: NextRequest) {
  await deleteSession();
  const reason = request.nextUrl.searchParams.get("reason");
  const loginUrl = new URL("/login", request.url);
  if (reason === "inactive") loginUrl.searchParams.set("notice", "inactive");
  return NextResponse.redirect(loginUrl);
}
