import type { Metadata } from "next";
import { listTerminals } from "@/lib/terminals/service";
import { listServiceLines, listTenantUserTerminals } from "@/lib/starlink/inventory";
import { describeStarlinkError, friendlyStarlinkErrorMessage } from "@/lib/starlink/client";
import { getAuthorizedUser } from "@/lib/auth/dal";
import type { AddTerminalOptions } from "@/components/admin/AddTerminalModal";
import { TerminalsPageClient } from "@/components/admin/TerminalsPageClient";
import type { TerminalStatus, FaultStatus } from "@/lib/terminals/types";

export const metadata: Metadata = {
  title: "Terminals | Hybrid Networks Admin",
};

// Live Starlink details for the Add Terminal form (Super Admin only): every
// service line with its account number, and the account's terminals that are
// not attached to a service line yet.
async function loadAddTerminalOptions(): Promise<AddTerminalOptions> {
  try {
    const [lines, terminals] = await Promise.all([listServiceLines(), listTenantUserTerminals()]);
    return {
      serviceLines: lines.map((l) => ({
        serviceLineNumber: l.serviceLineNumber,
        nickname: l.nickname,
        accountNumber: l.accountNumber,
        product: l.productReferenceId,
        active: l.active,
        endDate: l.endDate,
      })),
      unattachedTerminals: terminals
        .filter((t) => !t.serviceLineNumber)
        .map((t) => ({ userTerminalId: t.userTerminalId, kitSerialNumber: t.kitSerialNumber, dishSerialNumber: t.dishSerialNumber })),
      error: null,
    };
  } catch (err) {
    console.error(`[admin] Add Terminal options: ${describeStarlinkError(err)}`);
    return { serviceLines: [], unattachedTerminals: [], error: friendlyStarlinkErrorMessage(err) };
  }
}

export default async function TerminalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? (sp.status as TerminalStatus | "ALL") : "ALL";
  const faultStatus = typeof sp.faultStatus === "string" ? (sp.faultStatus as FaultStatus | "ANY") : "ANY";

  const canAdd = Boolean(await getAuthorizedUser(["SUPER_ADMIN"]));
  const [terminals, addOptions] = await Promise.all([
    listTerminals({ q, status, faultStatus }),
    canAdd ? loadAddTerminalOptions() : Promise.resolve(null),
  ]);

  const stats = {
    total: terminals.length,
    online: terminals.filter((t) => t.live.onlineStatus === "ONLINE").length,
    openFaults: terminals.filter((t) => t.faults.some((f) => f.status === "OPEN")).length,
    suspended: terminals.filter((t) => t.status === "SUSPENDED").length,
  };

  return <TerminalsPageClient terminals={terminals} q={q} status={status} faultStatus={faultStatus} stats={stats} addOptions={addOptions} />;
}
