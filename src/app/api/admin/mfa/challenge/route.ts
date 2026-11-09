import { NextRequest, NextResponse } from "next/server";
import {
  consumeAdminMfaChallenge, consumeAdminTotpCounter, createAdminSession,
  getAdminTotpCredential, getValidAdminMfaChallenge, recordAdminMfaChallengeFailure,
} from "@/lib/db";
import { createSessionToken, hashSessionToken, isSameOrigin } from "@/lib/admin-session";
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
  const challengeHash = hashMagicLinkToken(raw);
  if (!(await getValidAdminMfaChallenge(challengeHash))) {
    return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  }
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
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
    const attempts = await recordAdminMfaChallengeFailure(challengeHash);
    const response = NextResponse.json({ error: "Invalid authenticator code" }, {
      status: 401, headers: { ...HEADERS, ...(attempts >= 5 ? { "Retry-After": "300" } : {}) },
    });
    if (attempts >= 5) response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin/mfa", maxAge: 0 });
    return response;
  }
  if (!(await consumeAdminTotpCounter(counter))) {
    await recordAdminMfaChallengeFailure(challengeHash);
    return NextResponse.json({ error: "Authenticator code has already been used" }, { status: 401, headers: HEADERS });
  }
  await consumeAdminMfaChallenge(challengeHash);
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
