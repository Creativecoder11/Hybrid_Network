import "server-only";

// Client for the SLASH API (https://slash-prod.web.app/docs), which fronts
// Starlink's Enterprise data for this tenant. The docs page is a client-only
// SPA with no static content — this base URL and auth scheme were recovered
// from its shipped JS bundle and confirmed live against the real key.
//
// Despite its name, API_URL in .env holds the SLASH API key, not a URL — it's
// sent as the X-API-Key header.
const SLASH_API_BASE_URL = process.env.STARLINK_API_BASE_URL || "https://slash-api.rudra.sh/api/v1";

function getApiKey(): string {
  const key = process.env.API_URL;
  if (!key) {
    throw new Error("Missing API_URL environment variable (SLASH API key).");
  }
  return key;
}

export class StarlinkApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "StarlinkApiError";
    this.status = status;
    this.body = body;
  }
}

export async function starlinkFetch<T>(
  path: string,
  init?: { method?: string; query?: Record<string, string | number | boolean | undefined>; body?: unknown }
): Promise<T> {
  const url = new URL(SLASH_API_BASE_URL + path);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: init?.method ?? "GET",
      headers: {
        "X-API-Key": getApiKey(),
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    throw new StarlinkApiError(0, null, `Failed to reach SLASH API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && String((data as { message: unknown }).message)) ||
      `SLASH API request failed (${res.status})`;
    throw new StarlinkApiError(res.status, data, message);
  }

  return data as T;
}
