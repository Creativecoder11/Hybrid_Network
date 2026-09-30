import "server-only";

// Base URLs for links in emails. In the subdomain-split deployment the admin
// instance sends customer emails (invitations, invoices), so a customer link
// must never fall back to that instance's own NEXT_PUBLIC_APP_URL: customers
// can't sign in to the admin portal. See docs/deployment.md.

const DEFAULT_CUSTOMER_PORTAL_URL = "https://login.hybridnetworks.net.au";

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/** Origin of the customer portal, without a trailing slash. */
export function customerPortalBaseUrl(): string {
  if (process.env.CUSTOMER_PORTAL_URL) return trimSlash(process.env.CUSTOMER_PORTAL_URL);
  if (process.env.PORTAL_MODE !== "admin" && process.env.NEXT_PUBLIC_APP_URL) {
    return trimSlash(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.PORTAL_MODE === "admin") {
    console.error("[config] CUSTOMER_PORTAL_URL is not set on the admin deployment; customer email links use the default customer portal URL.");
  }
  return DEFAULT_CUSTOMER_PORTAL_URL;
}

/** Origin of the admin portal, without a trailing slash. */
export function adminPortalBaseUrl(): string {
  return trimSlash(process.env.ADMIN_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
}
