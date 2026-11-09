import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const SESSION_BYTES = 32;

export function verifyAdminToken(candidate: string, expected: string | undefined): boolean {
  if (!expected || !candidate) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}

export function getAdminTokenFromBody(input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const token = (input as Record<string, unknown>).token;
  return typeof token === "string" && token.length > 0 && token.length <= 1024 ? token : null;
}

/** Prefer Vercel's edge-provided client IP. Never trust a client-supplied x-forwarded-for chain. */
export function getAdminAuthClientKey(request: Request, pepper: string | undefined): string | null {
  if (!pepper) return null;
  const rawIp = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
  const ip = rawIp?.split(",")[0]?.trim();
  if (!ip || isIP(ip) === 0) return null;
  return createHmac("sha256", pepper).update(ip).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(SESSION_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function authorizeAdminSession(
  token: string | undefined,
  lookup: (tokenHash: string) => Promise<boolean>
): Promise<boolean> {
  if (!token) return false;
  return lookup(hashSessionToken(token));
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
