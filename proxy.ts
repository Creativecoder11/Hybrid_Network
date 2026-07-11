import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";

// Token-gated pages: always reachable regardless of an existing session,
// since the token itself (not the cookie) is the authority here.
const ALWAYS_PUBLIC_PREFIXES = ["/set-password", "/reset-password"];

// Pages that make no sense for an already-authenticated user.
const LOGGED_OUT_ONLY_PREFIXES = ["/login", "/forgot-password"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await getSession();
  const home = session ? (session.role === "CUSTOMER" ? "/portal" : "/admin") : "/login";

  if (pathname === "/") {
    return NextResponse.redirect(new URL(home, req.url));
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isPortalRoute = pathname.startsWith("/portal");
  const isLoggedOutOnlyRoute = LOGGED_OUT_ONLY_PREFIXES.some((p) => pathname.startsWith(p));

  if ((isAdminRoute || isPortalRoute) && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session?.role === "CUSTOMER") {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  if (isPortalRoute && session && session.role !== "CUSTOMER") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (isLoggedOutOnlyRoute && session) {
    return NextResponse.redirect(new URL(home, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
