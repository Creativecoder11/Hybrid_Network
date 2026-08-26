import "server-only";

// Client for the SLASH API (https://slash-prod.web.app/docs), which fronts
// Starlink's Enterprise data for this tenant. The docs page is a client-only
// SPA with no static content — this base URL and auth scheme were recovered
// from its shipped JS bundle and confirmed live against the real key.
//
// SLASH_API_KEY / SLASH_API_BASE_URL are the preferred env var names. The
// original names (API_URL holding the key, STARLINK_API_BASE_URL for the
// base URL) are kept as fallbacks so existing deployed .env files with the
// old names keep working — see .env.example.
// Trailing-slash-stripped: a base URL with a trailing slash (e.g. from a
// misconfigured .env) plus a path starting with "/" produces a double slash
// ("/api/v1//vessels"), which the real SLASH API 404s on — confirmed live:
// every call was silently failing until this was normalized. See
// docs/slash-api-integration-plan.md.
const SLASH_API_BASE_URL = (
  process.env.SLASH_API_BASE_URL || process.env.STARLINK_API_BASE_URL || "https://slash-api.rudra.sh/api/v1"
).replace(/\/+$/, "");

function getApiKey(): string {
  const key = process.env.SLASH_API_KEY || process.env.API_URL;
  if (!key) {
    throw new Error("Missing SLASH_API_KEY environment variable (SLASH API key).");
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

// Friendly, non-leaking messages for the documented HTTP status matrix.
// The real body (parsed JSON, or null) is still attached to the error for
// server-side logging — only this mapped message is safe to show a user.
const STATUS_MESSAGES: Record<number, string> = {
  400: "The request to the terminal provider was invalid.",
  401: "Terminal provider authentication failed.",
  403: "Not permitted to access this terminal provider resource.",
  404: "That resource was not found in the terminal provider.",
  409: "That request conflicts with the terminal provider's current state.",
  429: "The terminal provider is rate-limiting requests. Please try again shortly.",
  500: "The terminal provider is temporarily unavailable.",
};

export function friendlyStarlinkErrorMessage(err: unknown): string {
  if (err instanceof StarlinkApiError) {
    return STATUS_MESSAGES[err.status] ?? "Unable to reach the terminal provider. Please try again.";
  }
  return "Unable to load terminal data. Please try again.";
}

type FetchInit = {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Seconds to let Next.js cache this GET response for (rate-limit friendly). Omit for no-store. */
  revalidateSeconds?: number;
};

// Simple in-flight de-dupe: concurrent identical GET calls (e.g. two widgets
// on the same dashboard both asking for the vessel list) share one request
// instead of each hitting the API — important given SLASH's documented
// per-minute rate limits on several endpoints.
const inFlight = new Map<string, Promise<unknown>>();

function buildUrl(path: string, query?: FetchInit["query"]): string {
  const url = new URL(SLASH_API_BASE_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function rawFetch(url: string, init: FetchInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    return await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        "X-API-Key": getApiKey(),
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      ...(init.revalidateSeconds !== undefined
        ? { next: { revalidate: init.revalidateSeconds } }
        : { cache: "no-store" as const }),
    });
  } catch (err) {
    throw new StarlinkApiError(0, null, `Failed to reach SLASH API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

const MAX_RETRIES = 2;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry(url: string, init: FetchInit): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await rawFetch(url, init);
    if (res.ok || !RETRY_STATUS.has(res.status) || attempt >= MAX_RETRIES) return res;

    // Defensive backoff — SLASH's exact rate-limit numbers aren't confirmed
    // in the docs we have, so this reacts to real 429/5xx responses rather
    // than pacing against an assumed limit.
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const backoffMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 400 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    attempt += 1;
  }
}

export async function starlinkFetch<T>(path: string, init?: FetchInit): Promise<T> {
  const url = buildUrl(path, init?.query);
  const method = init?.method ?? "GET";
  const dedupeKey = method === "GET" ? url : null;

  if (dedupeKey && inFlight.has(dedupeKey)) {
    return inFlight.get(dedupeKey) as Promise<T>;
  }

  const run = async (): Promise<T> => {
    const res = await fetchWithRetry(url, init ?? {});
    const text = await res.text();
    // Error responses aren't guaranteed to be JSON (e.g. a plain-text "404
    // page not found" from the edge router) — parse defensively so a
    // malformed/non-JSON body surfaces as a normal StarlinkApiError instead
    // of an unhandled JSON.parse SyntaxError.
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = res.ok ? null : text;
      }
    }

    if (!res.ok) {
      const hasMessage = !!data && typeof data === "object" && "message" in data;
      const message = hasMessage
        ? String((data as { message: unknown }).message)
        : `SLASH API request failed (${res.status})`;
      throw new StarlinkApiError(res.status, data, message);
    }

    return data as T;
  };

  const promise = run();
  if (dedupeKey) {
    inFlight.set(dedupeKey, promise);
    promise.finally(() => inFlight.delete(dedupeKey)).catch(() => {});
  }
  return promise;
}
