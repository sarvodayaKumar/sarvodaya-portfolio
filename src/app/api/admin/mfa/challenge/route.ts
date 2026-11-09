import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminAuthAttempts, completeAdminMfaChallenge, createAdminSession, getAdminAuthAttempts, getAdminTotpCredential,
  getValidAdminMfaChallenge, recordAdminMfaChallengeFailure, recordFailedAdminAuthAttempt,
  revokeAdminSession,
} from "@/lib/db";
import { createSessionToken, getAdminMfaAccountKey, getAdminMfaClientKey, hashSessionToken, isSameOrigin } from "@/lib/admin-session";
import { auditAdminAuthEvent } from "@/lib/admin-audit";
import { decryptTotpSecret, getTotpCounterForCode, hashMagicLinkToken } from "@/lib/admin-mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "admin_mfa_challenge";
const HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(COOKIE)?.value;
  const pending = raw ? await getValidAdminMfaChallenge(hashMagicLinkToken(raw)) : false;
  return NextResponse.json(pending ? { pending: true } : { pending: false }, {
    status: 200, headers: HEADERS,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  const bodyLength = Number(request.headers.get("content-length") ?? 0);
  if (bodyLength > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const challengeHash = hashMagicLinkToken(raw);
  if (!(await getValidAdminMfaChallenge(challengeHash))) {
    return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  }
  const clientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminMfaAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  const throttle = await getAdminAuthAttempts(clientKey, accountKey, 15 * 60);
  if (throttle.clientAttempts >= 5 || throttle.accountAttempts >= 5) {
    return NextResponse.json({ error: "MFA verification temporarily locked. Sign in again later." }, {
      status: 429, headers: { ...HEADERS, "Retry-After": "900" },
    });
  }
  const rawBody = await request.text();
  if (rawBody.length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const body = await (async () => { try { return JSON.parse(rawBody) as { code?: unknown }; } catch { return null; } })();
  if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Enter a valid six-digit code" }, { status: 400, headers: HEADERS });
  }
  const credential = await getAdminTotpCredential();
  if (!credential?.enabled) return NextResponse.json({ error: "Authenticator is not configured" }, { status: 503, headers: HEADERS });
  let counter: number | null = null;
  try {
    counter = getTotpCounterForCode(decryptTotpSecret(credential.encryptedSecret), body.code);
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  }
  if (counter === null) {
    await auditAdminAuthEvent(request, "totp_challenge", false);
    const attempts = await recordAdminMfaChallengeFailure(challengeHash);
    const ipAttempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    const accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
    const locked = attempts >= 5 || ipAttempts > 5 || accountAttempts > 5;
    const response = NextResponse.json({ error: locked ? "MFA verification temporarily locked. Sign in again later." : "Invalid authenticator code" }, {
      status: locked ? 429 : 401,
      headers: { ...HEADERS, ...(locked ? { "Retry-After": "900" } : {}) },
    });
    if (locked) response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin/mfa", maxAge: 0 });
    return response;
  }
  if (!(await completeAdminMfaChallenge(challengeHash, counter))) {
    await auditAdminAuthEvent(request, "totp_challenge", false);
    const ipAttempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    const accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
    return NextResponse.json({ error: ipAttempts > 5 || accountAttempts > 5 ? "MFA verification temporarily locked" : "Authenticator code has already been used or challenge expired" }, {
      status: ipAttempts > 5 || accountAttempts > 5 ? 429 : 401,
      headers: { ...HEADERS, ...(ipAttempts > 5 || accountAttempts > 5 ? { "Retry-After": "900" } : {}) },
    });
  }
  await clearAdminAuthAttempts(clientKey);
  await clearAdminAuthAttempts(accountKey);
  await auditAdminAuthEvent(request, "totp_challenge", true);
  const priorSession = request.cookies.get("admin_session")?.value;
  if (priorSession) await revokeAdminSession(hashSessionToken(priorSession));
  const token = createSessionToken();
  await createAdminSession(hashSessionToken(token), new Date(Date.now() + SESSION_TTL_SECONDS * 1000), true);
  const response = NextResponse.json({ ok: true }, { headers: HEADERS });
  response.cookies.set("admin_session", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api", maxAge: SESSION_TTL_SECONDS,
  });
  response.cookies.set(COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/admin/mfa", maxAge: 0,
  });
  return response;
}
