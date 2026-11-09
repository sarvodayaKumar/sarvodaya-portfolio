import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import bcrypt from "bcryptjs";

const SESSION_BYTES = 32;

export function safeEqual(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verify bcrypt hashes (cost 12); reject passwords exceeding bcrypt's 72-byte limit. */
export async function verifyAdminPassword(password: string, encoded: string | undefined): Promise<boolean> {
  if (!encoded || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(encoded) || !password || password.length > 1024) return false;
  if (bcrypt.truncates(password)) return false;
  try {
    return await bcrypt.compare(password, encoded);
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


/** Verify bcrypt hashes (cost 12); reject passwords exceeding bcrypt's 72-byte limit. */
export async function verifyAdminPassword(password: string, encoded: string | undefined): Promise<boolean> {
  if (!encoded || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(encoded) || !password || password.length > 1024) return false;
  if (bcrypt.truncates(password)) return false;
  try {
    return await bcrypt.compare(password, encoded);
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
