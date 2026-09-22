import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveConnectivity } from "@/lib/terminals/status";
import { applyLocationPolicy } from "@/lib/portal/features";
import { fmtMbps, fmtPct, fmtUptime, fmtText, NOT_AVAILABLE } from "@/lib/utils/telemetry";
import { customerAccountSchema, portalUserSchema, parseList } from "@/lib/validations/account";
import { settingsSchema } from "@/lib/validations/settings";
import { firstLoginChangePasswordSchema } from "@/lib/validations/auth";
import { slashWriteNotifyAddress } from "@/lib/starlink/passthrough";
import { friendlyStarlinkErrorMessage, StarlinkApiError } from "@/lib/starlink/client";
import type { TerminalRecord } from "@/lib/terminals/types";

const NOW = Date.parse("2026-09-22T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

test("online status comes from telemetry freshness, not the service-line flag", () => {
  assert.equal(deriveConnectivity({ telemetryAvailable: true, lastSeenAt: minutesAgo(3), now: NOW }).onlineStatus, "ONLINE");
  assert.equal(deriveConnectivity({ telemetryAvailable: true, lastSeenAt: minutesAgo(60), now: NOW }).onlineStatus, "OFFLINE");
  assert.equal(deriveConnectivity({ telemetryAvailable: true, lastSeenAt: null, now: NOW }).onlineStatus, "OFFLINE");
  const apiDown = deriveConnectivity({ telemetryAvailable: false, lastSeenAt: minutesAgo(1), now: NOW });
  assert.equal(apiDown.onlineStatus, "UNKNOWN", "an API outage is never shown as 'offline'");
  assert.equal(apiDown.connectionState, "UNKNOWN");
});

test("online threshold is configurable", () => {
  process.env.TERMINAL_ONLINE_THRESHOLD_MINUTES = "90";
  try {
    assert.equal(deriveConnectivity({ telemetryAvailable: true, lastSeenAt: minutesAgo(60), now: NOW }).onlineStatus, "ONLINE");
  } finally {
    delete process.env.TERMINAL_ONLINE_THRESHOLD_MINUTES;
  }
});

test("unavailable telemetry renders as 'Not available', never as 0", () => {
  assert.equal(fmtPct(null), NOT_AVAILABLE);
  assert.equal(fmtPct(0), "0%", "a real 0 reading is still shown");
  assert.equal(fmtMbps(null), NOT_AVAILABLE);
  assert.equal(fmtMbps(123.4), "123 Mbps");
  assert.equal(fmtMbps(4.25), "4.3 Mbps");
  assert.equal(fmtUptime(null), NOT_AVAILABLE);
  assert.equal(fmtUptime(3 * 86400 + 4 * 3600), "3d 4h");
  assert.equal(fmtText(""), NOT_AVAILABLE);
  assert.equal(fmtText("2026.09.01.mr12345"), "2026.09.01.mr12345");
});

test("location policy strips coordinates and history when disabled", () => {
  const terminal = {
    id: "ut1",
    location: { latitude: -33.8, longitude: 151.2, altitudeMeters: 0, accuracyMeters: 0, timestamp: minutesAgo(1) },
    locationHistory: [{ id: "h1", latitude: -33.8, longitude: 151.2, altitudeMeters: 0, accuracyMeters: 0, timestamp: minutesAgo(5) }],
  } as unknown as TerminalRecord;
  const hidden = applyLocationPolicy(terminal, { deviceLocation: false, tracking: false });
  assert.equal(hidden.location, null);
  assert.deepEqual(hidden.locationHistory, []);
  assert.equal(applyLocationPolicy(terminal, { deviceLocation: true, tracking: true }), terminal);
});

test("account form validation", () => {
  const ok = customerAccountSchema.safeParse({
    customerId: "65f000000000000000000001",
    accountNumber: "10001",
    starlinkVesselIds: parseList("019ff593-6557-785c-ac33-36d11b7f301c\n019ff593-6557-785c-ac33-36d11b7f301c"),
  });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.starlinkVesselIds.length, 1, "duplicate vessel ids are collapsed");
  assert.equal(customerAccountSchema.safeParse({ customerId: "65f000000000000000000001", accountNumber: "bad code!" }).success, false);
  assert.equal(customerAccountSchema.safeParse({ customerId: "not-an-id", accountNumber: "10001" }).success, false);
});

test("portal user must get at least one account unless given all accounts", () => {
  const base = { profileId: "65f000000000000000000001", name: "Jane Doe", email: "Jane@Example.com" };
  assert.equal(portalUserSchema.safeParse({ ...base, accountAccessAll: false, accountIds: [] }).success, false);
  const all = portalUserSchema.safeParse({ ...base, accountAccessAll: true });
  assert.equal(all.success, true);
  if (all.success) assert.equal(all.data.email, "jane@example.com");
  assert.equal(
    portalUserSchema.safeParse({ ...base, accountAccessAll: false, accountIds: ["65f000000000000000000002"] }).success,
    true
  );
  assert.equal(portalUserSchema.safeParse({ ...base, accountAccessAll: false, accountIds: ["x"] }).success, false);
});

test("first-login change requires a strong new password that matches confirmation", () => {
  assert.equal(firstLoginChangePasswordSchema.safeParse({ currentPassword: "HN-AB#cd", newPassword: "short", confirmPassword: "short" }).success, false);
  assert.equal(
    firstLoginChangePasswordSchema.safeParse({ currentPassword: "HN-AB#cd", newPassword: "LongEnough1", confirmPassword: "LongEnough2" }).success,
    false
  );
  assert.equal(
    firstLoginChangePasswordSchema.safeParse({ currentPassword: "HN-AB#cd", newPassword: "LongEnough1", confirmPassword: "LongEnough1" }).success,
    true
  );
});

test("settings: ABN must be 11 digits when given", () => {
  const base = { companyName: "Hybrid Networks", companyLegalName: "Hybrid Networks Pty Ltd", currency: "AUD", taxLabel: "GST", taxRate: 10, invoicePrefix: "HINV", timezone: "Australia/Sydney" };
  assert.equal(settingsSchema.safeParse({ ...base, companyAbn: "51 824 753 556" }).success, true);
  assert.equal(settingsSchema.safeParse({ ...base, companyAbn: "1234" }).success, false);
  assert.equal(settingsSchema.safeParse({ ...base, companyAbn: "" }).success, true);
});

test("SLASH WRITE notifications go to Station Satcom by default", () => {
  delete process.env.SLASH_WRITE_NOTIFY_EMAIL;
  assert.equal(slashWriteNotifyAddress(), "service@stationsatcom.com");
});

test("SLASH errors map to safe user messages", () => {
  assert.match(friendlyStarlinkErrorMessage(new StarlinkApiError(408, null, "timeout")), /too long/);
  assert.match(friendlyStarlinkErrorMessage(new StarlinkApiError(429, null, "slow down")), /rate-limiting/);
  assert.match(friendlyStarlinkErrorMessage(new StarlinkApiError(401, { message: "bad key sk_live_x" }, "bad key")), /authentication failed/);
  assert.doesNotMatch(friendlyStarlinkErrorMessage(new StarlinkApiError(401, { message: "bad key sk_live_x" }, "bad key sk_live_x")), /sk_/);
});
