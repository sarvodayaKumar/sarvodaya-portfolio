import { NextRequest, NextResponse } from "next/server";
import {
  createAdminMfaChallenge,
  createAdminSession,
  getAdminTotpCredential,
  getAdminSessionWithMfaPolicy,
  revokeAdminSession,
  recordFailedAdminAuthAttempt,
  clearAdminAuthAttempts,
} from "@/lib/db";
import {
  authorizeAdminSession,
  createSessionToken,
  hashSessionToken,
  isSameOrigin,
  safeEqual,
  verifyAdminPassword,
  getAdminAuthClientKey,
  getAdminCredentialsFromBody,
} from "@/lib/admin-session";
import { createEmailMagicLinkToken, hashMagicLinkToken } from "@/lib/admin-mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC AUTHENTICATION POLICY: GET reveals only whether this browser has a valid
// session; POST is same-origin credential verification with persistent throttling;
// DELETE is same-origin logout. No admin data is exposed by this endpoint.

const COOKIE_NAME = "admin_session";
const MFA_CHALLENGE_COOKIE = "admin_mfa_challenge";
const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const AUTH_WINDOW_SECONDS = 15 * 60;
const MAX_FAILED_AUTH_ATTEMPTS = 5;
const AUTH_FAILURE = { error: "Unable to authenticate" };
const RESPONSE_HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await authorizeAdminSession(token, getAdminSessionWithMfaPolicy);
  return NextResponse.json(valid ? { ok: true } : { error: "Unauthorized" }, {
    status: valid ? 200 : 401, headers: RESPONSE_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: RESPONSE_HEADERS });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4096) return NextResponse.json(AUTH_FAILURE, { status: 413, headers: RESPONSE_HEADERS });
  const raw = await request.text();
  if (raw.length > 4096) return NextResponse.json(AUTH_FAILURE, { status: 413, headers: RESPONSE_HEADERS });
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json(AUTH_FAILURE, { status: 400, headers: RESPONSE_HEADERS });
  }
  const credentials = getAdminCredentialsFromBody(body);
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const clientKey = getAdminAuthClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey) {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: RESPONSE_HEADERS });
  }

  // Increment before the expensive scrypt operation so the persistent limit also
  // protects the password verifier from repeated CPU/memory-exhaustion attempts.
  let attempts: number;
  try {
    attempts = await recordFailedAdminAuthAttempt(clientKey, AUTH_WINDOW_SECONDS);
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: RESPONSE_HEADERS });
  }
  if (attempts > MAX_FAILED_AUTH_ATTEMPTS) {
    return NextResponse.json(AUTH_FAILURE, {
      status: 429, headers: { ...RESPONSE_HEADERS, "Retry-After": String(AUTH_WINDOW_SECONDS) },
    });
  }

  let valid = false;
  if (credentials && username && passwordHash) {
    const usernameValid = safeEqual(credentials.username.toLowerCase(), username.trim().toLowerCase());
    const passwordValid = await verifyAdminPassword(credentials.password, passwordHash);
    valid = usernameValid && passwordValid;
  }
  if (!valid) {
    return NextResponse.json(AUTH_FAILURE, { status: 401, headers: RESPONSE_HEADERS });
  }

  try {
    await clearAdminAuthAttempts(clientKey);
    const credential = await getAdminTotpCredential();
    if (credential?.enabled) {
      const challengeToken = createEmailMagicLinkToken();
      await createAdminMfaChallenge(
        hashMagicLinkToken(challengeToken),
        new Date(Date.now() + MFA_CHALLENGE_TTL_SECONDS * 1000)
      );
      const response = NextResponse.json({ ok: true, mfaRequired: true }, { headers: RESPONSE_HEADERS });
      response.cookies.set(MFA_CHALLENGE_COOKIE, challengeToken, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "strict", path: "/api/admin/mfa", maxAge: MFA_CHALLENGE_TTL_SECONDS,
      });
      return response;
    }
    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await createAdminSession(hashSessionToken(sessionToken), expiresAt, false);
    const response = NextResponse.json({ ok: true, mfaRequired: false }, { headers: RESPONSE_HEADERS });
    setSessionCookie(response, sessionToken);
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: RESPONSE_HEADERS });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: RESPONSE_HEADERS });
  }
  const token = request.cookies.get(COOKIE_NAME)?.value;
  try {
    if (token) await revokeAdminSession(hashSessionToken(token));
  } catch {
    return NextResponse.json({ error: "Unable to sign out" }, { status: 503, headers: RESPONSE_HEADERS });
  }
  const response = NextResponse.json({ ok: true }, { headers: RESPONSE_HEADERS });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api", maxAge: 0,
  });
  response.cookies.set(MFA_CHALLENGE_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/admin/mfa", maxAge: 0,
  });
  return response;
}
