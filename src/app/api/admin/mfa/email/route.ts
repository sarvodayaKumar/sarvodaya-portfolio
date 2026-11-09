import { NextRequest, NextResponse } from "next/server";
import {
  consumeAdminEmailOtpChallenge,
  createAdminSession,
  createAdminEmailOtpChallenge,
  getAdminTotpCredential,
  getValidAdminMfaChallenge,
  recordAdminEmailOtpFailure,
  revokeAdminSession,
} from "@/lib/db";
import { createSessionToken, hashSessionToken, isSameOrigin } from "@/lib/admin-session";
import { generateEmailOtp, hashMagicLinkToken, hashOneTimeCode } from "@/lib/admin-mfa";
import { sendAdminMfaEmailCode } from "@/lib/admin-email";

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
    path: "/api/admin/mfa",
    maxAge: 0,
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
  const credential = await getAdminTotpCredential();
  if (!credential?.enabled) return NextResponse.json({ error: "Complete authenticator enrollment first" }, { status: 409, headers: HEADERS });

  const code = generateEmailOtp();
  const saved = await createAdminEmailOtpChallenge(
    challengeHash,
    hashOneTimeCode(code, "email-mfa"),
    new Date(Date.now() + OTP_TTL_SECONDS * 1000),
  );
  if (!saved) return NextResponse.json({ error: "Email code limit reached. Use your authenticator or sign in again." }, { status: 429, headers: HEADERS });
  if (!(await sendAdminMfaEmailCode(code))) {
    return NextResponse.json({ error: "Email delivery is unavailable. Use your authenticator or try again later." }, { status: 503, headers: HEADERS });
  }
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
  if (!(await consumeAdminEmailOtpChallenge(challengeHash, codeHash))) {
    const attempts = await recordAdminEmailOtpFailure(challengeHash);
    const response = NextResponse.json({ error: attempts >= 5 ? "Email code attempts exceeded. Sign in again." : "Invalid or expired email code." }, {
      status: 401, headers: HEADERS,
    });
    if (attempts >= 5) clearChallengeCookie(response);
    return response;
  }

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
