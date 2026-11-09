import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_BYTES = 32;

export function verifyAdminToken(candidate: string, expected: string | undefined): boolean {
  if (!expected || !candidate) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
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
