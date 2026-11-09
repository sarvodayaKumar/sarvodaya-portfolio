import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminAuthAttempts,
  consumeAdminEmailOtpChallenge,
  createAdminSession,
  createAdminEmailOtpChallenge,
  getAdminTotpCredential,
  getAdminAuthAttempts,
  getValidAdminMfaChallenge,
  recordAdminEmailOtpFailure,
  recordFailedAdminAuthAttempt,
  revokeAdminSession,
} from "@/lib/db";
import { createSessionToken, getAdminMfaAccountKey, getAdminMfaClientKey, hashSessionToken, isSameOrigin } from "@/lib/admin-session";
import { generateEmailOtp, hashMagicLinkToken, hashOneTimeCode } from "@/lib/admin-mfa";
import { sendAdminMfaEmailCode } from "@/lib/admin-email";
import { auditAdminAuthEvent } from "@/lib/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "admin_mfa_challenge";
const HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const OTP_TTL_SECONDS = 5 * 60;

function clearChallengeCookie(response: NextResponse) {
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const rawBody = await request.text();
  if (rawBody.length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  const challengeHash = hashMagicLinkToken(raw);
  if (!(await getValidAdminMfaChallenge(challengeHash))) {
    return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  }
  const credential = await getAdminTotpCredential();
  if (!credential?.enabled) return NextResponse.json({ error: "Complete authenticator enrollment first" }, { status: 409, headers: HEADERS });
  const clientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminMfaAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  const ipAttempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
  const accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
  if (ipAttempts > 5 || accountAttempts > 5) return NextResponse.json({ error: "Email verification temporarily locked" }, {
    status: 429, headers: { ...HEADERS, "Retry-After": "900" },
  });

  const code = generateEmailOtp();
  if (!(await sendAdminMfaEmailCode(code))) {
    await auditAdminAuthEvent(request, "email_otp", false);
    return NextResponse.json({ error: "Email delivery is unavailable. Use your authenticator or try again later." }, { status: 503, headers: HEADERS });
  }
  const saved = await createAdminEmailOtpChallenge(
    challengeHash,
    hashOneTimeCode(code, "email-mfa"),
    new Date(Date.now() + OTP_TTL_SECONDS * 1000),
  );
  if (!saved) return NextResponse.json({ error: "Email code limit reached. Use your authenticator or sign in again." }, { status: 429, headers: HEADERS });
  await auditAdminAuthEvent(request, "email_otp", true);
  return NextResponse.json({ ok: true, message: "A one-time code was sent to the administrator email address." }, { headers: HEADERS });
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  const challengeHash = hashMagicLinkToken(raw);
  if (!(await getValidAdminMfaChallenge(challengeHash))) {
    return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const rawBody = await request.text();
  if (rawBody.length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  let body: { code?: unknown } | null = null;
  try { body = JSON.parse(rawBody) as { code?: unknown }; } catch { /* generic invalid body */ }
  if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Enter a valid six-digit code" }, { status: 400, headers: HEADERS });
  }

  const codeHash = hashOneTimeCode(body.code, "email-mfa");
  const clientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminMfaAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  const throttle = await getAdminAuthAttempts(clientKey, accountKey, 15 * 60);
  if (throttle.clientAttempts >= 5 || throttle.accountAttempts >= 5) {
    const response = NextResponse.json({ error: "Email verification temporarily locked. Sign in again later." }, {
      status: 429, headers: { ...HEADERS, "Retry-After": "900" },
    });
    clearChallengeCookie(response);
    return response;
  }
  if (!(await consumeAdminEmailOtpChallenge(challengeHash, codeHash))) {
    await auditAdminAuthEvent(request, "email_otp", false);
    const attempts = await recordAdminEmailOtpFailure(challengeHash);
    const ipAttempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    const accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
    const locked = attempts >= 5 || ipAttempts > 5 || accountAttempts > 5;
    const response = NextResponse.json({ error: locked ? "Email verification temporarily locked. Sign in again later." : "Invalid or expired email code." }, {
      status: locked ? 429 : 401,
      headers: { ...HEADERS, ...(locked ? { "Retry-After": "900" } : {}) },
    });
    if (locked) clearChallengeCookie(response);
    return response;
  }

  await clearAdminAuthAttempts(clientKey);
  await clearAdminAuthAttempts(accountKey);
  await auditAdminAuthEvent(request, "email_otp", true);
  const priorSession = request.cookies.get("admin_session")?.value;
  if (priorSession) await revokeAdminSession(hashSessionToken(priorSession));
  const token = createSessionToken();
  await createAdminSession(hashSessionToken(token), new Date(Date.now() + SESSION_TTL_SECONDS * 1000), true);
  const response = NextResponse.json({ ok: true }, { headers: HEADERS });
  response.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: SESSION_TTL_SECONDS,
  });
  clearChallengeCookie(response);
  return response;
}
