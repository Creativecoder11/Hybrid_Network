import "server-only";
import { starlinkFetch } from "./client";

// Tenant-wide inventory: every service line and every user terminal on the
// Starlink account, including terminals not attached to any service line
// (which GET /vessels cannot show). Read fresh — the Add Terminal form must
// reflect the account as it is right now.

export type SlashServiceLine = {
  serviceLineNumber: string;
  accountNumber: string;
  nickname: string;
  productReferenceId: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
};

export type SlashTenantUserTerminal = {
  userTerminalId: string;
  kitSerialNumber: string;
  dishSerialNumber: string;
  active: boolean;
  /** "" when the terminal is not attached to a service line. */
  serviceLineNumber: string;
  vesselId: string;
  vesselName: string;
};

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

async function listAll<T>(path: string, key: string, query: Record<string, string | boolean>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const raw = await starlinkFetch<Record<string, unknown>>(path, { query: { ...query, page, limit: PAGE_LIMIT } });
    const batch = Array.isArray(raw?.[key]) ? (raw[key] as T[]) : [];
    all.push(...batch);
    const total = typeof raw?.totalCount === "number" ? raw.totalCount : all.length;
    if (batch.length === 0 || all.length >= total) break;
  }
  return all;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export async function listServiceLines(): Promise<SlashServiceLine[]> {
  const rows = await listAll<Record<string, unknown>>("/service-lines", "serviceLines", { status: "all" });
  return rows
    .filter((r) => text(r.serviceLineNumber))
    .map((r) => ({
      serviceLineNumber: text(r.serviceLineNumber),
      accountNumber: text(r.accountNumber),
      nickname: text(r.nickname),
      productReferenceId: text(r.productReferenceId),
      startDate: text(r.startDate) || null,
      endDate: text(r.endDate) || null,
      active: r.active === true,
    }));
}

export async function listTenantUserTerminals(): Promise<SlashTenantUserTerminal[]> {
  const rows = await listAll<Record<string, unknown>>("/user-terminals", "userTerminals", { includeInactive: true });
  return rows
    .filter((r) => text(r.userTerminalId))
    .map((r) => ({
      userTerminalId: text(r.userTerminalId),
      kitSerialNumber: text(r.kitSerialNumber),
      dishSerialNumber: text(r.dishSerialNumber),
      active: r.active === true,
      serviceLineNumber: text(r.serviceLineNumber),
      vesselId: text(r.vesselId),
      vesselName: text(r.vesselName),
    }));
}
