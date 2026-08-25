# SLASH API Integration — Phase 1: Capability Matrix & Architecture

Status: draft for review. No implementation code written yet, per the
"don't start coding until this analysis is complete" instruction.

## 0. Reality check — please read this first

The request this plan responds to says *"I have provided the complete SLASH
API documentation as a reference"* and lists dozens of endpoints, response
fields, and rate limits. **No documentation file, link, or pasted spec was
actually attached to that message** — only the endpoint list embedded in the
prose itself.

Separately, this repo already contains a real, working, partial integration
with the SLASH API (`lib/starlink/`), built in an earlier session. Its own
code comments explain why: the official docs at `slash-prod.web.app/docs`
and `slash.stationone.io/passthrough-docs` are **client-rendered SPAs with no
static content** — there is no fetchable doc page. What exists in
`lib/starlink/client.ts`, `read.ts`, `types.ts`, and `passthrough.ts` was
recovered by reading the docs site's shipped JS bundle and then
**confirmed live against the real API key** — i.e. it's the one source of
truth in this repo that's actually been verified, as opposed to inferred.

Cross-checking the request's endpoint/field list against that verified
client: **roughly half of the endpoints and most of the telemetry field
names in the request do not appear anywhere in the confirmed integration.**
That doesn't mean they're wrong — the SLASH API surface is almost certainly
larger than what one sandbox tenant's read-only exploration turned up — but
per the request's own rule #41 ("Never fabricate endpoint URLs... write NOT
CONFIRMED BY PROVIDED API DOCUMENTATION"), I'm treating anything not present
in the verified client as unconfirmed rather than building UI against it.

**This is the one blocking question for Phase 1**: is there a fuller spec
(Postman collection, OpenAPI/Swagger JSON, PDF, written doc) beyond what's
already reverse-engineered in `lib/starlink/`? See the question at the end
of this document / the chat message that follows it.

Everything below is built strictly from: (a) `lib/starlink/*` (verified),
(b) the rest of this codebase (verified by reading it directly), and (c)
the request's own text, with every unverified item explicitly labeled.

---

## 1. API Capability Matrix

Legend: ✅ Confirmed = implemented and live-tested in `lib/starlink/`.
⚠️ Confirmed shape, empty data = the endpoint is real and typed, but the
one sandbox tenant's traffic has never populated it, so its *populated*
shape is unverified. ❌ NOT CONFIRMED = appears only in the request text;
no evidence it exists.

### Read endpoints

| Endpoint (request) | Status | Notes |
|---|---|---|
| `GET /vessels` | ✅ | Paginated (`page`, `limit`), returns `{vessels, totalCount, page, limit}`. `listVessels()` in `read.ts` auto-paginates. |
| `GET /vessels/{vesselId}` | ✅ | Returns a `SlashVessel`, which **embeds** its `userTerminals[]` — there's no separate call needed for this tenant. |
| `GET /vessels/{vesselId}/user-terminals` | ❌ | Not used/needed — terminals come embedded on the vessel object above. May not exist as a separate route. |
| `GET /vessels/{vesselId}/data-usage/current` | ✅ | Returns priority/standard/opt-in/non-billable/total GB + billing cycle dates. |
| `GET /vessels/{vesselId}/data-usage/history` | ❌ | NOT CONFIRMED. |
| `GET /vessels/{vesselId}/data-blocks` | ❌ | NOT CONFIRMED. |
| `GET /vessels/{vesselId}/service-plan` | ✅ | Plan name, priority/standard GB, price, currency, overage flags, billing cycle, auto-renew. |
| `GET /vessels/{vesselId}/service-plan/history` | ❌ | NOT CONFIRMED. |
| `GET /vessels/{vesselId}/location/current` | ✅ | `{latitude, longitude, timestamp, h3CellId}`. `(0,0)` is treated as "no GPS fix" in `liveProvider.ts`. |
| `GET /vessels/{vesselId}/location/history` | ✅ | Paginated, `{historyPoints[], totalCount, page, limit}` inside a `timeRange`. Current wrapper doesn't pass date-range params yet — needs extending, not inventing. |
| `GET /vessels/location/current` (fleet-wide) | ❌ | NOT CONFIRMED. |
| `GET /vessels/location/history/bulk` | ❌ | NOT CONFIRMED. |
| `GET /vessels/{vesselId}/connectivity/status` | ⚠️ | Endpoint is real and typed (`{vesselId, timestamp, connectivityStats: unknown[]}`), but `connectivityStats` has been empty for every observed call — its populated shape (latency/uptime/signal fields etc.) is genuinely unknown, not just unimplemented. |
| `GET /vessels/{vesselId}/connectivity/history` | ❌ | NOT CONFIRMED. |
| `GET /telemetry/vessels/latest` | ❌ | NOT CONFIRMED. This is the endpoint the request leans on hardest for live monitoring (signal %, throughput, uptime, obstruction %, ping latency/drop rate) — none of those fields appear anywhere in the verified client. |
| `GET /alerts/user-terminals` | ✅ | Paginated, `{totalCount, pageIndex, pageSize, data: []}`. Every field on the alert episode (`severity`, `message`, `startedAt`, etc.) is typed *optional* in `types.ts` because the sandbox tenant has never produced a real alert — the shape is inferred, not observed populated. |
| `GET /alerts/routers` | ❌ | NOT CONFIRMED. |
| `GET /analytics/fleet/connectivity` | ❌ | NOT CONFIRMED. |
| `GET /analytics/fleet/data-usage` | ❌ | NOT CONFIRMED. |
| `GET /service-lines` (top-level) | ❌ | NOT CONFIRMED (per-vessel service-line data comes embedded on `SlashVessel` instead: `serviceLineNumber`, `serviceLineNickname`, `serviceLineActive`, etc.). |
| `GET /routers` (top-level) | ❌ | NOT CONFIRMED as a *read* endpoint. Routers only appear as a `router_id` parameter on write passthrough actions (see below) — there's no confirmed way to list/read router state or telemetry. |
| `GET /user-terminals` (top-level) | ❌ | NOT CONFIRMED. |
| Addresses (`GET /addresses` or similar) | ⚠️ | A `SlashAddress`/`SlashAddressListResponse` type exists in `types.ts` (used by `create_address` passthrough), suggesting a read endpoint exists, but no `read.ts` function calls it yet — untested. |
| Products | ❌ | NOT CONFIRMED as a read endpoint (only appears as `productReferenceId` fields elsewhere). |

### Write endpoints (passthrough — `lib/starlink/passthrough.ts`)

These are genuinely more solid than the read side: 19 actions recovered
from the passthrough docs SPA's JS bundle **and cross-checked against the
real OpenAPI operation** (`{METHOD} /starlink/{api_name}`). None are wired
to any UI yet — `sendTerminalCommand()` in `lib/terminals/service.ts`
currently only mutates local `TerminalState`, it never calls these.

| Request's "Remote Commands" concept | Real passthrough equivalent | Status |
|---|---|---|
| Reboot terminal | `reboot_user_terminal` (`POST`, needs `vesselId` + `deviceId`) | ✅ confirmed action exists |
| Reboot router | *(not in request list, but supported)* `reboot_router` (`POST`) | ✅ confirmed |
| Suspend service | `deactivate_service_line` (`DELETE`) | ⚠️ exists, but this **ends** the service line (with `endNow`/cancellation reason) — that's a harder, less-reversible operation than "suspend," and needs `accountNumber` which isn't currently stored on `User`. Needs product sign-off before wiring as a one-click "Suspend" button. |
| Reactivate service | — | ❌ NOT CONFIRMED. `service_line_opt_in`/`opt_out` exist but control *data opt-in*, not reactivating a deactivated line. No "undo deactivate" action found. |
| Refresh service | — | ❌ NOT CONFIRMED. |
| Firmware update | — | ❌ NOT CONFIRMED. |
| Diagnostics | — | ❌ NOT CONFIRMED. |
| *(not requested, but available)* | `set_recurring_blocks`, `add_topup_data`, `update_service_line_nickname`, `update_product_put`, `set_public_ip`, `create_terminal`, `add/remove_terminal_from_service_line`, `create_service_line`, `create_address`, router config CRUD | ✅ confirmed, unused |

### Rate limits

The request lists specific per-minute limits (Vessels List 10/min, Telemetry
40/min, etc.). **NOT CONFIRMED** — nothing in `lib/starlink/client.ts` or its
comments mentions rate limits, and no 429 has apparently been observed/coded
for. `starlinkFetch()` currently has no rate-limit awareness at all. I'll
design the client to *handle* 429s defensively (backoff, surfaced clearly)
without hardcoding the specific numbers from the request as fact.

### Auth & errors

- ✅ `X-API-Key` header (not `X-API-KEY`, but headers are case-insensitive
  over HTTP so this is a non-issue), `Accept: application/json`.
- ✅ Errors: `starlinkFetch` throws `StarlinkApiError` with `status` + parsed
  `body`, message extracted from `body.message` when present. Confirmed
  shape for at least one error status; the full 400/401/403/404/409/429/500
  matrix from the request is **not individually confirmed** — the client
  handles "not `res.ok`" generically today rather than branching per code.

---

## 2. Data model

`lib/starlink/types.ts` already covers most of the request's "Create proper
types" ask: `SlashVessel`, `SlashUserTerminal`, `SlashDataUsage`,
`SlashServicePlan`, `SlashLocation`, `SlashVesselConnectivityStatusResponse`,
`SlashAlertEpisode`, `SlashAddress`, `SlashServiceLine`. Gaps against the
request's list:

- **Router** — no confirmed read shape (routers are write-only targets via
  `router_id`/`config_id`). A `Router` type can't be written honestly yet.
- **Telemetry** — no confirmed endpoint at all (see matrix above), so no
  `Telemetry` type can be written without fabricating fields.
- **Connectivity** — typed, but its populated shape is unknown (`unknown[]`
  today). Will need to loosen/tighten the type the first time a real
  non-empty response is observed.

`lib/terminals/types.ts` (`TerminalRecord`) is the **existing UI contract**
— `TerminalDetailClient`, `DeviceCard`, and `TerminalsPageClient` are all
built against it, and `mockProvider.ts` / `liveProvider.ts` both already
satisfy it. This is effectively the "Repository" layer the request asks
for in §37 — it already exists, and already documents its own honest gaps
in code comments (zeroed latency/throughput/signal fields, empty ICCID/IMEI
for Starlink terminals, `auditHistory: []` for live records, etc.). I'd
extend this contract rather than replace it.

---

## 3. Architecture — what to build vs. what already exists

The request's suggested `lib/slash/` layout (`client.ts`, `vessels.ts`,
`telemetry.ts`, `locations.ts`, `usage.ts`, `alerts.ts`, `service-lines.ts`,
`service-plans.ts`) is a reasonable refinement of the existing
`lib/starlink/client.ts` + `read.ts` (which currently lumps every domain
into one file). Recommendation: **split `read.ts` by domain to match this
layout, keep the `lib/starlink/` directory name** (renaming risks breaking
the "don't change things unnecessarily" spirit, and `starlink` is already
the name used in `User.starlinkVesselId`/`starlinkServiceLineNumber`,
`CustomerFormModal`'s "Starlink Linking" section, and every existing code
comment) — a `telemetry.ts`/`service-lines.ts` file would sit empty or
stubbed until those endpoints are confirmed.

```
lib/starlink/
├── client.ts          # existing — request+error handling, unchanged
├── vessels.ts          ← split from read.ts
├── locations.ts         ← split from read.ts
├── usage.ts             ← split from read.ts
├── service-plans.ts     ← split from read.ts
├── connectivity.ts       ← split from read.ts (⚠️ empty-shape caveat surfaced in JSDoc)
├── alerts.ts            ← split from read.ts
├── passthrough.ts      # existing, untouched
└── types.ts            # existing, extended as new fields get confirmed
```

`lib/terminals/service.ts` stays the single seam the rest of the app
imports from (per its own header comment) — no page or component should
ever import `lib/starlink/*` directly.

### Repository/mock-adapter pattern (§37)

Already implemented exactly as requested: `mockProvider.ts` and
`liveProvider.ts` both satisfy `TerminalProvider`/`TerminalRecord`, and
`service.ts` merges them. Nothing to change architecturally here — new
domains (once confirmed) slot into the same pattern.

---

## 4. Route structure — existing vs. requested

The request's route list doesn't match this app's existing naming in
several places. Per "if a page already exists, keep its current structure,"
I'd keep existing names and only add genuinely new pages, rather than
create parallel routes that duplicate an existing one under a new name:

| Request asked for | Existing equivalent | Plan |
|---|---|---|
| `/admin/dashboard` | `/admin` (billing-focused dashboard) | Extend existing `/admin` with fleet stat cards (§6) rather than fork a second dashboard route. |
| `/admin/terminals`, `/admin/terminals/[id]` | Already exist | Extend with real data + tabs for confirmed domains only. |
| `/admin/customers`, `/admin/customers/[id]` | Already exist | No change needed beyond surfacing linked-vessel status if useful. |
| `/admin/alerts` | *(new)* | Build — backed by confirmed `/alerts/user-terminals` only; a "Routers" sub-tab stays disabled ("Not supported by current API") since `/alerts/routers` is unconfirmed. |
| `/admin/analytics` | *(new)* | ❌ Both underlying endpoints (`/analytics/fleet/*`) are unconfirmed. Would ship as a page that computes fleet-level aggregates **client/server-side from `/vessels` + per-vessel data** (which the app already fetches), clearly labeled as app-computed, not "the API's analytics." |
| `/admin/usage` | Currently only inside terminal detail | Build a fleet-wide usage page aggregating confirmed `data-usage/current` per vessel (no history endpoint to chart trends against — flagged as a gap). |
| `/admin/tracking` | *(new)* | Build on confirmed `location/current` + `location/history` per vessel. No bulk/fleet endpoint exists, so a fleet map means one call per vessel — needs pagination/throttling awareness given unconfirmed rate limits. |
| `/admin/reports` | *(new)* | App-generated CSV/JSON/Excel from already-fetched data (`papaparse`/`xlsx` already in `package.json` — no new dependency needed). |
| `/admin/settings` | Already exists | No change. |
| `/customer/dashboard`, `/customer/terminals`, etc. | `/portal`, `/portal/devices`, ... | Keep the existing `/portal/*` prefix — `proxy.ts` already branches on it, and renaming would touch the auth gate for no benefit. Map: `/customer/terminals`→`/portal/devices` (existing), `/customer/tracking`→new `/portal/tracking`, `/customer/service-plan`→existing `/portal/plans` (already plan-focused — avoid a duplicate route), `/customer/alerts`→new `/portal/alerts`, `/customer/reports`→new `/portal/reports`. |

---

## 5. Security architecture

Already solid and matches the request's requirements closely — this is
existing, verified behavior, not a proposal:

- Custom JWT session (`jose`), httpOnly cookie, checked in `proxy.ts`
  (route-level redirect) **and independently re-checked** in
  `app/admin/layout.tsx` / `app/portal/layout.tsx` (`requireRole`) **and**
  in every Server Action via `getAuthorizedUser()` in `lib/actions/*.ts` —
  i.e. already "never trust frontend role checks alone" in practice.
- Roles are `SUPER_ADMIN` / `SUB_ADMIN` / `CUSTOMER` (request's spec used
  a generic `ADMIN` — I'll map new admin-only checks to
  `["SUPER_ADMIN","SUB_ADMIN"]`, matching every existing admin action).
- `API_URL`/`STARLINK_API_BASE_URL` are read only in files marked
  `import "server-only"` — never touch a Client Component. Same pattern
  will apply to any new server modules.
- Audit logging already exists: `models/ActivityLog.ts`, written from
  Server Actions (e.g. `TERMINAL_COMMAND`). New actions (once real
  passthrough writes are wired) log the same way. Note:
  `TerminalRecord.auditHistory` shown in the Terminal Detail "Audit
  History" tab is currently **mock/canned data**, separate from the real
  `ActivityLog` collection — worth reconciling so the tab shows real
  activity for live-linked terminals.

---

## 6. Explicitly unsupported today (per rule #41 — stated, not silently dropped)

- Live telemetry dashboard as specified (signal %, throughput, uptime,
  obstruction %, ping latency/drop rate, `stale` flag) — **NOT CONFIRMED**,
  no `/telemetry/*` endpoint found.
- Router inventory/alerts/telemetry — **NOT CONFIRMED** beyond write-only
  `router_id` targeting.
- Any historical charting for connectivity, data usage, or service plan —
  **NOT CONFIRMED** (only "current" snapshots exist for these three).
- Fleet-wide analytics endpoints — **NOT CONFIRMED**; would be
  app-computed from existing per-vessel data instead.
- "Refresh service," "Firmware update," "Diagnostics" remote commands —
  **NOT CONFIRMED**; UI ships disabled ("Not supported by current API")
  per the request's own §33 fallback rule.
- Specific numeric rate limits — **NOT CONFIRMED**; client will be built
  defensively (handle 429, backoff) without asserting numbers I can't
  verify.

---

## 7. What I need from you to move past this

1. **Is there a real SLASH API spec beyond `lib/starlink/`** (Postman
   collection, OpenAPI/Swagger file, PDF, written doc from the client)?
   If yes, please share it — that would upgrade most of the ❌ rows above
   to buildable features instead of disabled placeholders. If no, I'll
   proceed treating `lib/starlink/` as ground truth and build the ❌ items
   as clearly-labeled "coming soon" states per your own §33 rule.
2. Given the scope, I'd suggest going phase-by-phase with a short check-in
   after each (Phase 2: split/extend the API client for confirmed domains;
   Phase 3 is already mostly done — light RBAC extension only; Phase 4/5:
   admin + portal pages; Phase 6: tracking/usage/alerts UI; Phase 7+:
   reports/audit/hardening) rather than generating all ten phases unreviewed
   in one pass, given how much of the later phases depend on the answer to
   (1).
