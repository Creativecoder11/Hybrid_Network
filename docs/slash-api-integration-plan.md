# SLASH API Integration — Capability Matrix & Architecture

Status: Phase 1 analysis, plus Phases 2–8 implemented against the confirmed
endpoint surface (see §8 below for what shipped and what's still gated on
real documentation).

## Critical bug found and fixed during implementation

While wiring the new pages up to live data, every single call to the SLASH
API was silently failing — confirmed by hitting `/vessels` directly with
the real key and getting `404 page not found`, even though this is the most
basic, most-verified endpoint in the codebase.

**Root cause**: `.env`'s `STARLINK_API_BASE_URL` has a trailing slash
(`https://slash-api.rudra.sh/api/v1/`). `lib/starlink/client.ts` built
request URLs as `SLASH_API_BASE_URL + path` (e.g. `+ "/vessels"`), so the
actual request went to `.../api/v1//vessels` — a double slash the API's
router doesn't match, hence 404. Verified directly: the exact same request
with the trailing slash stripped returns `200` with real vessel data.

**Impact**: this means *any customer ever linked* to a real Starlink vessel
via `User.starlinkVesselId` would have silently shown up with **zero
terminals** in both the admin and customer portal — `liveProvider.ts`'s
`safe()` wrapper caught the resulting error and returned `null`/`[]`
exactly as designed for genuine API failures, so nothing crashed, but the
live integration has likely never actually worked end-to-end until now.

**Fix**: `lib/starlink/client.ts` now strips trailing slashes from the base
URL before building request URLs, regardless of what's in `.env`. Verified
live after the fix — see §8.

## 0. Reality check — please read this first

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

## 7. Decisions on record

You chose: treat `lib/starlink/` as ground truth (no fuller spec available),
and build everything in one pass rather than phase-by-phase check-ins. What
follows is what actually shipped under that decision.

## 8. What was implemented (verified against the live API)

**`lib/starlink/` restructure** — split into `vessels.ts`, `locations.ts`,
`usage.ts`, `service-plans.ts`, `connectivity.ts`, `alerts.ts` (domain
functions), plus new `schemas.ts` (Zod validation on every confirmed
response shape, §38) and `validate.ts` (logs on drift instead of crashing).
`client.ts` gained: retry/backoff on 429/5xx, in-flight GET de-duplication,
per-call opt-in short caching (`revalidateSeconds`), and — critically — the
trailing-slash fix above. `passthrough.ts` and its 19 write actions were
left untouched.

**Real command wiring** — `lib/terminals/service.ts`'s `sendTerminalCommand`
now calls the real `reboot_user_terminal` passthrough action for REBOOT on
live-linked terminals (confirmed endpoint), with a stronger confirm dialog
and a "Live — sent to the real device" label in the UI. Every other command
(Refresh Service, Suspend, Reactivate, Update Firmware, Diagnostics) stays
local-only, labeled "Simulated — not supported by current API" (Suspend
specifically notes it needs an `accountNumber` this app doesn't capture —
`deactivate_service_line` exists but wasn't wired without that field and
explicit sign-off, since it ends the service line rather than pausing it).

**Admin**: `/admin` dashboard extended with a Fleet Overview section (total/
online/offline/suspended, connectivity averages, usage breakdown, recent
alerts) below the existing billing content — nothing existing was restyled.
New pages: `/admin/alerts`, `/admin/tracking` (GPS map + history), `/admin/
usage`, `/admin/analytics` (labeled app-computed), `/admin/reports` (export
center). `/admin/terminals/[id]` gained a location map, a real freshness
indicator, and an Audit History tab now sourced from `ActivityLog` (real)
instead of only canned mock entries.

**Customer portal**: new `/portal/devices/[id]` detail page (didn't exist
before — the list only had cards), `/portal/tracking`, `/portal/alerts`,
`/portal/reports`. Every query is scoped server-side to the logged-in
customer — verified live: a customer hitting the admin export route gets
`403`, and their own export route returns only their 1 terminal, not the
fleet's 7.

**Reports/export** (§31): `lib/reports/export.ts` + `rows.ts` generate CSV/
JSON/Excel from already-fetched data for 5 report types × both portals.
Verified live: all 15 admin combinations return `200` with correctly-typed,
non-empty payloads (alerts report is legitimately empty — no alert data
exists for this tenant).

**GPS map**: no tile-based map library is wired in. `npm install leaflet
react-leaflet` hit a reproducible npm registry integrity error in this
environment (corrupted tarball bytes, same package, three separate retries)
— not a real problem with the package, but couldn't be worked around here.
`components/ui/LocationMap.tsx` is a dependency-free inline-SVG coordinate
plot (graticule, markers, history trail, click-to-select) behind the same
`points`/`trail`/`onSelectPoint` props a real Leaflet component would use,
so swapping in real tiles later is a one-file change, not a re-plumb.
**Action for you**: run `npm install leaflet react-leaflet@5` in a normal
environment when convenient.

**Env vars**: `SLASH_API_KEY` / `SLASH_API_BASE_URL` are now the preferred
names (matching your spec), with `API_URL` / `STARLINK_API_BASE_URL` kept
as fallbacks so the existing deployed `.env` keeps working unchanged.

## 9. Still gated on real documentation

Everything in §6 above is unchanged — telemetry, router alerts/inventory,
connectivity/usage/plan history, fleet analytics endpoints, and most remote
commands are still "not supported by current API" placeholders, not
guesses. If you get a fuller spec from the client, the ❌ rows in §1 are
where to start.

## 10. Official spec, verified field mapping (September 2026 update)

The docs page at `slash-prod.web.app/docs` embeds a complete Swagger 2.0
document in its shipped JS bundle. It has been extracted to
[`docs/slash-api-spec.json`](slash-api-spec.json) (72 paths, 165 models).
Several endpoints listed as "NOT CONFIRMED" in §1 are in that spec and are now
used. Every field below comes from the spec, not from guesses.

### Device data (portal My Devices / Overview / admin Terminals)

| Portal field | SLASH source |
|---|---|
| Online / Offline | `GET /telemetry/vessels/latest` → `lastSeenAt` (fallback `latestTelemetryTimestamp`). ONLINE when newer than `TERMINAL_ONLINE_THRESHOLD_MINUTES` (default 15), OFFLINE otherwise or when never seen, UNKNOWN when the telemetry call fails. See `lib/terminals/status.ts`. |
| Connection status | Same as above: CONNECTED / DISCONNECTED / UNKNOWN |
| Service status (Active / Service line inactive) | `GET /vessels` → `serviceLineActive`, `userTerminals[].active` |
| Signal quality | `telemetry` → `signalQualityPercent` |
| Download / upload throughput | `telemetry` → `downlinkThroughputMbps` / `uplinkThroughputMbps` (sample time `latestTelemetryTimestamp`) |
| Latency | `telemetry` → `pingLatencyMsAvg` |
| Ping drop rate | `telemetry` → `pingDropRateAvg` (unit not stated in the spec; treated as Starlink's 0–1 fraction and shown as %) |
| Obstruction | `telemetry` → `obstructionPercentTime` |
| Uptime since boot | `telemetry` → `uptimeSeconds` |
| Firmware version | `telemetry` → `runningSoftwareVersion` |
| Location | `GET /vessels/{id}/location/current` (bulk: `GET /vessels/location/current`) → `latitude`, `longitude`, `timestamp`; fallback: telemetry `latitude`/`longitude`. (0,0) = no fix. |
| Location history | `GET /vessels/{id}/location/history` (`startDate`/`endDate` RFC3339, max 2 months) |
| Kit / dish serial, terminal id | `GET /vessels` → `userTerminals[].kitSerialNumber`, `dishSerialNumber`, `userTerminalId` |
| Terminal name | `serviceLineNickname`, else `vesselName` |
| Current-cycle usage | `GET /vessels/{id}/data-usage/current` (bulk: `/vessels/data-usage/bulk/current`) → `priorityGB`, `standardGB`, `nonBillableGB`, `totalGB`, cycle dates |
| Daily usage history | `GET /vessels/{id}/data-usage/history` → `historyPoints[]` (per day) |
| Starlink plan | `GET /vessels/{id}/service-plan` → `planName`, `allocatedDataGB`, `priorityDataGB`, `standardDataGB`, `blockDataGB`, `topUpDataGB`, overage, cycle, auto-renew. `price` is **not shown to customers** (wholesale). |
| Alerts | `GET /alerts/user-terminals` → `deviceId`, `alertName`, `alertDescription`, `active`, `firstSeen`, `lastSeen` (the previous code read non-existent `userTerminalId`/`endedAt`/`severity`) |

**Unavailable from the current API** (shown as "Not available", never as 0):
signal strength in dBm, link quality, 30-day uptime %, hardware health
(power, temperature, voltage, antenna alignment, modem, SIM), upload vs
download byte split, router alerts (spec: "currently unpopulated upstream").

### Fixes made while integrating

- Online status was `serviceLineActive && terminal.active` — i.e. "subscribed",
  not "connected". It now comes from telemetry freshness.
- `GET /vessels` hides inactive service lines unless `includeInactive=true`;
  now always passed, so suspended customers' terminals don't disappear.
- List views use fleet-wide bulk endpoints (one telemetry call, one usage
  call, one location call) instead of five calls per vessel.
- `lib/terminals/mockProvider.ts` (fabricated devices for any customer with an
  ICCID) is now off unless `ENABLE_DEMO_TERMINALS=true`, and never serves the
  customer portal.

### WRITE operations

All passthrough WRITE actions go through `executeSlashWrite()` in
`lib/starlink/passthrough.ts`: the call fails unless both the HTTP status and
the passthrough's inner `status_code` indicate success; every attempt is
audited (`SLASH_WRITE_OPERATION` / `SLASH_WRITE_FAILED`), and each successful
WRITE emails `service@stationsatcom.com` (override: `SLASH_WRITE_NOTIFY_EMAIL`)
with operation, account numbers, service line, device/KIT, product,
initiating user, UTC time and a portal reference. The only WRITE wired to the
UI today is terminal reboot (`reboot_user_terminal`).
