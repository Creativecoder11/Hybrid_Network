import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export function generateMetadata(): Metadata {
  const portalMode = process.env.PORTAL_MODE;
  if (portalMode === "admin") {
    return { title: "Reset Admin Password | Hybrid Networks" };
  }
  if (portalMode === "customer") {
    return { title: "Reset Customer Password | Hybrid Networks" };
  }
  return { title: "Forgot Password | Hybrid Networks" };
}

export default function ForgotPasswordPage() {
  const portalMode = process.env.PORTAL_MODE as "admin" | "customer" | undefined;
  return <ForgotPasswordForm portalMode={portalMode} />;
}
