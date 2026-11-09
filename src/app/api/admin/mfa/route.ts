import { NextRequest, NextResponse } from "next/server";
import {
  disableAdminTotp, enableAdminTotp, getAdminTotpCredential, getRecentAdminMfaSession,
  clearAdminAuthAttempts, getAdminAuthAttempts, getValidAdminMfaChallenge, getValidAdminSession,
  recordFailedAdminAuthAttempt, recordAdminTotpEnrollmentFailure, revokeAllAdminSessions,
  savePendingAdminTotpSecret,
} from "@/lib/db";
import { authorizeAdminSession, getAdminAuthAccountKey, getAdminAuthClientKey, getAdminMfaAccountKey, getAdminMfaClientKey, isSameOrigin, verifyAdminPassword } from "@/lib/admin-session";
import { auditAdminAuthEvent } from "@/lib/admin-audit";
import {
  buildTotpUri, decryptTotpSecret, encryptTotpSecret, generateTotpSecret,
  generateAdminRecoveryCodes, getTotpCounterForCode, hashMagicLinkToken, hashOneTimeCode,
} from "@/lib/admin-mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };
const SESSION_COOKIE = "admin_session";
const CHALLENGE_COOKIE = "admin_mfa_challenge";

async function signedIn(request: NextRequest) {
  return authorizeAdminSession(request.cookies.get(SESSION_COOKIE)?.value, getValidAdminSession);
}

export async function GET(request: NextRequest) {
  const challenge = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (challenge) {
    const pending = await getValidAdminMfaChallenge(hashMagicLinkToken(challenge));
    if (pending) return NextResponse.json({ mode: "challenge" }, { headers: HEADERS });
  }
  if (!(await signedIn(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  }
  const credential = await getAdminTotpCredential();
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const canManage = await authorizeAdminSession(sessionToken, (tokenHash) => getRecentAdminMfaSession(tokenHash, 10 * 60));
  return NextResponse.json({
    mode: "enrollment",
    enabled: credential?.enabled ?? false,
    pending: Boolean(credential && !credential.enabled),
    canManage,
  }, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  if (!(await signedIn(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  const clientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminMfaAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  const throttle = await getAdminAuthAttempts(clientKey, accountKey, 15 * 60);
  if (throttle.clientAttempts >= 5 || throttle.accountAttempts >= 5) {
    return NextResponse.json({ error: "Authenticator enrollment temporarily locked" }, {
      status: 429, headers: { ...HEADERS, "Retry-After": "900" },
    });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const rawBody = await request.text();
  if (rawBody.length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const credential = await getAdminTotpCredential();
  if (credential?.enabled) return NextResponse.json({ error: "Authenticator is already enabled" }, { status: 409, headers: HEADERS });
  let secret: string;
  try {
    secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    const saved = await savePendingAdminTotpSecret(encrypted);
    if (!saved) {
      await auditAdminAuthEvent(request, "totp_enrollment", false);
      return NextResponse.json({ error: "Unable to start enrollment" }, { status: 409, headers: HEADERS });
    }
    await auditAdminAuthEvent(request, "totp_enrollment", true);
  } catch {
    return NextResponse.json({ error: "MFA is not configured on the server" }, { status: 503, headers: HEADERS });
  }
  const account = process.env.ADMIN_USERNAME ?? "admin";
  return NextResponse.json({
    secret,
    provisioningUri: buildTotpUri(secret, account),
    expiresInSeconds: 600,
  }, { headers: HEADERS });
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  if (!(await signedIn(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  const bodyLength = Number(request.headers.get("content-length") ?? 0);
  if (bodyLength > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const rawBody = await request.text();
  if (rawBody.length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const body = await (async () => { try { return JSON.parse(rawBody) as { code?: unknown }; } catch { return null; } })();
  if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Enter a valid six-digit code" }, { status: 400, headers: HEADERS });
  }
  const credential = await getAdminTotpCredential();
  if (!credential || credential.enabled) return NextResponse.json({ error: "No pending authenticator enrollment" }, { status: 409, headers: HEADERS });
  const mfaClientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const mfaAccountKey = getAdminMfaAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!mfaClientKey || !mfaAccountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  try {
    const secret = decryptTotpSecret(credential.encryptedSecret);
    const counter = getTotpCounterForCode(secret, body.code);
    if (counter === null) {
      await auditAdminAuthEvent(request, "totp_enrollment", false);
      const attempts = await recordAdminTotpEnrollmentFailure();
      const ipAttempts = await recordFailedAdminAuthAttempt(mfaClientKey, 15 * 60);
      const accountAttempts = await recordFailedAdminAuthAttempt(mfaAccountKey, 15 * 60);
      const locked = attempts >= 5 || ipAttempts > 5 || accountAttempts > 5;
      return NextResponse.json({ error: locked ? "Authenticator enrollment temporarily locked. Sign in again later." : "Invalid or expired authenticator code" }, {
        status: locked ? 429 : 401,
        headers: { ...HEADERS, ...(locked ? { "Retry-After": "900" } : {}) },
      });
    }
    const recoveryCodes = generateAdminRecoveryCodes(10);
    const recoveryHashes = recoveryCodes.map((recoveryCode) => hashOneTimeCode(recoveryCode.replace(/-/g, ""), "mfa-recovery"));
    const enabled = await enableAdminTotp(counter, recoveryHashes, credential.encryptedSecret, mfaClientKey, mfaAccountKey);
    if (!enabled) return NextResponse.json({ error: "Enrollment expired. Start again." }, { status: 409, headers: HEADERS });
    await auditAdminAuthEvent(request, "totp_enrollment", true);
    return NextResponse.json({
      ok: true,
      message: "Authenticator enabled. Save these recovery codes now; they are shown only once.",
      recoveryCodes,
    }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Unable to verify authenticator enrollment" }, { status: 503, headers: HEADERS });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!(await authorizeAdminSession(session, (tokenHash) => getRecentAdminMfaSession(tokenHash, 10 * 60)))) {
    return NextResponse.json({ error: "Complete MFA sign-in again before changing authenticator settings" }, { status: 401, headers: HEADERS });
  }
  const bodyLength = Number(request.headers.get("content-length") ?? 0);
  if (bodyLength > 2048) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const rawBody = await request.text();
  if (rawBody.length > 2048) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  let body: { password?: unknown } | null = null;
  try { body = JSON.parse(rawBody) as { password?: unknown }; } catch { /* generic invalid request */ }
  if (!body || typeof body.password !== "string") {
    return NextResponse.json({ error: "Administrator password is required" }, { status: 400, headers: HEADERS });
  }

  const clientKey = getAdminAuthClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminAuthAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  let attempts = 0;
  let accountAttempts = 0;
  try {
    attempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  }
  if (attempts > 5 || accountAttempts > 5) return NextResponse.json({ error: "Reauthentication temporarily locked" }, {
    status: 429, headers: { ...HEADERS, "Retry-After": "900" },
  });
  if (!(await verifyAdminPassword(body.password, process.env.ADMIN_PASSWORD_HASH))) {
    await auditAdminAuthEvent(request, "mfa_disable", false);
    return NextResponse.json({ error: "Reauthentication failed" }, { status: 401, headers: HEADERS });
  }
  const credential = await getAdminTotpCredential();
  if (!credential?.enabled) return NextResponse.json({ error: "Authenticator is not enabled" }, { status: 409, headers: HEADERS });
  if (!(await disableAdminTotp())) {
    return NextResponse.json({ error: "Unable to disable authenticator" }, { status: 409, headers: HEADERS });
  }
  await auditAdminAuthEvent(request, "mfa_disable", true);
  await clearAdminAuthAttempts(clientKey);
  await clearAdminAuthAttempts(accountKey);
  await revokeAllAdminSessions();
  const response = NextResponse.json({ ok: true, message: "Authenticator disabled. Sign in again and enroll a new factor before using admin APIs." }, { headers: HEADERS });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api", maxAge: 0,
  });
  response.cookies.set(CHALLENGE_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/admin/mfa", maxAge: 0,
  });
  return response;
}
