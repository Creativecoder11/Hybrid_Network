import type { Metadata } from "next";
import { listTerminals } from "@/lib/terminals/service";
import { TerminalsPageClient } from "@/components/admin/TerminalsPageClient";
import type { TerminalStatus, FaultStatus } from "@/lib/terminals/types";

export const metadata: Metadata = {
  title: "Terminals | Hybrid Networks Admin",
};

export default async function TerminalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? (sp.status as TerminalStatus | "ALL") : "ALL";
  const faultStatus = typeof sp.faultStatus === "string" ? (sp.faultStatus as FaultStatus | "ANY") : "ANY";

  const terminals = await listTerminals({ q, status, faultStatus });

  const stats = {
    total: terminals.length,
    online: terminals.filter((t) => t.live.onlineStatus === "ONLINE").length,
    openFaults: terminals.filter((t) => t.faults.some((f) => f.status === "OPEN")).length,
    suspended: terminals.filter((t) => t.status === "SUSPENDED").length,
  };

  return <TerminalsPageClient terminals={terminals} q={q} status={status} faultStatus={faultStatus} stats={stats} />;
}
