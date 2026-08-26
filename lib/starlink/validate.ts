import "server-only";
import type { ZodType } from "zod";

// Validates a SLASH API response against its expected shape (§38 — "external
// APIs should never be blindly trusted"). Logs and returns the raw data on
// mismatch rather than throwing: a field the API added/renamed shouldn't take
// the whole page down when the fields the UI actually reads are still there.
export function validateSlashResponse<T>(schema: ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[slash] response shape drift at ${context}:`, result.error.issues.slice(0, 5));
    return data as T;
  }
  return result.data;
}
