import { NextRequest, NextResponse } from "next/server";
import {
  createAdminMfaChallenge,
  revokeAllAdminMfaChallenges,
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
  getAdminAuthAccountKey,
  getAdminAuthClientKey,
  getAdminCredentialsFromBody,
} from "@/lib/admin-session";
import { createEmailMagicLinkToken, hashMagicLinkToken } from "@/lib/admin-mfa";
import { auditAdminAuthEvent } from "@/lib/admin-audit";

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

  // Persist both IP and account-wide buckets before the expensive bcrypt operation.
  const accountKey = username ? getAdminAuthAccountKey(username, process.env.ADMIN_AUTH_PEPPER) : null;
  const usernameMatches = Boolean(credentials && username && safeEqual(credentials.username.toLowerCase(), username.trim().toLowerCase()));
  let attempts = 0;
  let accountAttempts = 0;
  try {
    attempts = await recordFailedAdminAuthAttempt(clientKey, AUTH_WINDOW_SECONDS);
    if (usernameMatches && accountKey) {
      accountAttempts = await recordFailedAdminAuthAttempt(accountKey, AUTH_WINDOW_SECONDS);
    }
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: RESPONSE_HEADERS });
  }
  if (attempts > MAX_FAILED_AUTH_ATTEMPTS || accountAttempts > MAX_FAILED_AUTH_ATTEMPTS) {
    return NextResponse.json(AUTH_FAILURE, {
      status: 429, headers: { ...RESPONSE_HEADERS, "Retry-After": String(AUTH_WINDOW_SECONDS) },
    });
  }

  let valid = false;
  if (credentials && username && passwordHash) {
    const passwordValid = await verifyAdminPassword(credentials.password, passwordHash);
    valid = usernameMatches && passwordValid;
  }
  if (!valid) {
    await auditAdminAuthEvent(request, "password_sign_in", false);
    return NextResponse.json(AUTH_FAILURE, { status: 401, headers: RESPONSE_HEADERS });
  }

  try {
    await auditAdminAuthEvent(request, "password_sign_in", true);
    await clearAdminAuthAttempts(clientKey);
    if (accountKey) await clearAdminAuthAttempts(accountKey);
    const previousSession = request.cookies.get(COOKIE_NAME)?.value;
    if (previousSession) await revokeAdminSession(hashSessionToken(previousSession));
    const credential = await getAdminTotpCredential();
    if (credential?.enabled) {
      const challengeToken = createEmailMagicLinkToken();
      await createAdminMfaChallenge(
        hashMagicLinkToken(challengeToken),
        new Date(Date.now() + MFA_CHALLENGE_TTL_SECONDS * 1000)
      );
      const response = NextResponse.json({ ok: true, mfaRequired: true }, { headers: RESPONSE_HEADERS });
      response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api", maxAge: 0 });
      response.cookies.set(MFA_CHALLENGE_COOKIE, challengeToken, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "strict", path: "/api/admin", maxAge: MFA_CHALLENGE_TTL_SECONDS,
      });
      return response;
    }
    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await createAdminSession(hashSessionToken(sessionToken), expiresAt, false);
    // Password authentication grants only the restricted enrollment session. All admin APIs require MFA assurance.
    const response = NextResponse.json({ ok: true, mfaRequired: true }, { headers: RESPONSE_HEADERS });
    response.cookies.set(MFA_CHALLENGE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: 0 });
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
    await revokeAllAdminMfaChallenges();
  } catch {
    return NextResponse.json({ error: "Unable to sign out" }, { status: 503, headers: RESPONSE_HEADERS });
  }
  await auditAdminAuthEvent(request, "session_logout", true);
  const response = NextResponse.json({ ok: true }, { headers: RESPONSE_HEADERS });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api", maxAge: 0,
  });
  response.cookies.set(MFA_CHALLENGE_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/admin", maxAge: 0,
  });
  return response;
}
