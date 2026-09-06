import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export function generateMetadata(): Metadata {
  const portalMode = process.env.PORTAL_MODE;
  if (portalMode === "admin") {
    return { title: "Admin Portal Sign In | Hybrid Networks" };
  }
  if (portalMode === "customer") {
    return { title: "Customer Portal Sign In | Hybrid Networks" };
  }
  return { title: "Sign In | Hybrid Networks" };
}

export default function LoginPage() {
  const portalMode = process.env.PORTAL_MODE as "admin" | "customer" | undefined;
  const adminPortalUrl = process.env.ADMIN_PORTAL_URL;
  const customerPortalUrl = process.env.CUSTOMER_PORTAL_URL;

  return (
    <Suspense>
      <LoginForm
        portalMode={portalMode}
        adminPortalUrl={adminPortalUrl}
        customerPortalUrl={customerPortalUrl}
      />
    </Suspense>
  );
}
