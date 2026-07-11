import "server-only";
import crypto from "crypto";

export const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
