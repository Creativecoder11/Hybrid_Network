import "server-only";
import { cookies } from "next/headers";
import { encryptSession, decryptSession, type SessionPayload } from "@/lib/auth/jwt";

const COOKIE_NAME = "hn_session";
const REMEMBER_ME_EXPIRY = "30d";
const DEFAULT_EXPIRY = "12h";
const REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MS = 12 * 60 * 60 * 1000;

export async function createSession(
  userId: string,
  role: SessionPayload["role"],
  keepSignedIn: boolean
) {
  const expiresIn = keepSignedIn ? REMEMBER_ME_EXPIRY : DEFAULT_EXPIRY;
  const token = await encryptSession({ userId, role }, expiresIn);
  const cookieStore = await cookies();

  const options: Parameters<typeof cookieStore.set>[2] = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };

  if (keepSignedIn) {
    options.expires = new Date(Date.now() + REMEMBER_ME_MS);
  } else {
    // Session cookie (cleared when browser closes), but cap the JWT itself
    // at DEFAULT_MS so a long-lived browser session can't outlive intent.
    options.maxAge = DEFAULT_MS / 1000;
  }

  cookieStore.set(COOKIE_NAME, token, options);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return decryptSession(token);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
