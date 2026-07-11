import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/models/User";

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  throw new Error("Missing JWT_SECRET environment variable");
}
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

export async function encryptSession(
  payload: SessionPayload,
  expiresIn: string
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedKey);
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return { userId: payload.userId, role: payload.role as UserRole };
  } catch {
    return null;
  }
}
