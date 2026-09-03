import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";

// Token-gated pages: always reachable regardless of an existing session,
// since the token itself (not the cookie) is the authority here.
const ALWAYS_PUBLIC_PREFIXES = ["/set-password", "/reset-password"];

// Pages that make no sense for an already-authenticated user.
const LOGGED_OUT_ONLY_PREFIXES = ["/login", "/forgot-password"];

// Single-domain deployments (local dev, or one combined production domain)
// leave PORTAL_MODE unset and behave exactly as before: both /admin and
// /portal are served from the same origin, role-gated only.
//
// A subdomain-split deployment (e.g. admin.example.com + customer.example.com,
// each hPanel "Node.js Application" running this same codebase) sets
// PORTAL_MODE to tell this instance which audience it's for. Any request for
// the other portal's routes — from any visitor, logged in or not — is
// cross-redirected to the other subdomain via ADMIN_PORTAL_URL /
// CUSTOMER_PORTAL_URL, path and query preserved, instead of being served
// locally. See docs/deployment.md.
type PortalMode = "admin" | "customer" | undefined;
const PORTAL_MODE = process.env.PORTAL_MODE as PortalMode;
const ADMIN_PORTAL_URL = process.env.ADMIN_PORTAL_URL;
const CUSTOMER_PORTAL_URL = process.env.CUSTOMER_PORTAL_URL;

function crossDomainUrl(base: string, pathname: string, search: string): string {
  return new URL(pathname + search, base).toString();
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isPortalRoute = pathname.startsWith("/portal");

  // Mode/route mismatch — send the browser to the subdomain that actually
  // serves this portal, before even checking auth. Falls through to the
  // normal same-origin behavior below if the target URL isn't configured
  // yet, so a half-finished env setup fails safe rather than 404ing.
  if (PORTAL_MODE === "admin" && isPortalRoute && CUSTOMER_PORTAL_URL) {
    return NextResponse.redirect(crossDomainUrl(CUSTOMER_PORTAL_URL, pathname, search));
  }
  if (PORTAL_MODE === "customer" && isAdminRoute && ADMIN_PORTAL_URL) {
    return NextResponse.redirect(crossDomainUrl(ADMIN_PORTAL_URL, pathname, search));
  }

  const session = await getSession();
  const roleHome = session?.role === "CUSTOMER" ? "/portal" : "/admin";

  if (pathname === "/") {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    const rightPortalHere =
      PORTAL_MODE === "admin" ? roleHome === "/admin" : PORTAL_MODE === "customer" ? roleHome === "/portal" : true;
    if (rightPortalHere) return NextResponse.redirect(new URL(roleHome, req.url));
    const otherBase = roleHome === "/admin" ? ADMIN_PORTAL_URL : CUSTOMER_PORTAL_URL;
    if (otherBase) return NextResponse.redirect(crossDomainUrl(otherBase, roleHome, ""));
    return NextResponse.redirect(new URL(roleHome, req.url)); // env not configured yet — same-origin fallback
  }

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
    return NextResponse.redirect(new URL(roleHome, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
