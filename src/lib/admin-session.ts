import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isIP } from "node:net";

const scrypt = promisify(scryptCallback);
const SESSION_BYTES = 32;
const SCRYPT_N = 65_536;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

export function safeEqual(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Format: scrypt$N$r$p$salt$key (base64url); only bounded parameters are accepted. */
export async function verifyAdminPassword(password: string, encoded: string | undefined): Promise<boolean> {
  if (!encoded || !password || password.length > 1024) return false;
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  try {
    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");
    if (salt.length < 16 || salt.length > 64 || expected.length !== SCRYPT_KEY_LENGTH) return false;
    const actual = await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM,
    }) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function getAdminCredentialsFromBody(input: unknown): { username: string; password: string } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  if (typeof body.username !== "string" || body.username.length < 1 || body.username.length > 254) return null;
  if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 1024) return null;
  return { username: body.username.trim(), password: body.password };
}

/** Prefer the Vercel edge IP; never trust a client-supplied x-forwarded-for chain. */
export function getAdminAuthClientKey(request: Request, pepper: string | undefined): string | null {
  if (!pepper || pepper.length < 32) return null;
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
