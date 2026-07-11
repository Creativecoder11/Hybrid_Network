import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTerminal } from "@/lib/terminals/service";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { TerminalDetailClient } from "@/components/admin/TerminalDetailClient";

export const metadata: Metadata = {
  title: "Terminal Detail | Hybrid Networks Admin",
};

export default async function TerminalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const terminal = await getTerminal(decodeURIComponent(id));
  if (!terminal) notFound();

  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);

  return <TerminalDetailClient terminal={terminal} canManage={!!admin} />;
}
