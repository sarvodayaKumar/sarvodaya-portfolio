import { NextRequest, NextResponse } from "next/server";
import { auditAdminAuthEvent } from "@/lib/admin-audit";
import {
  clearAdminAuthAttempts,
  completeAdminMfaRecoveryChallenge,
  createAdminSession,
  getAdminSessionWithMfaPolicy,
  getAdminAuthAttempts,
  getAdminTotpCredential,
  recordAdminMfaChallengeFailure,
  recordFailedAdminAuthAttempt,
  regenerateAdminRecoveryCodes,
  revokeAdminSession,
} from "@/lib/db";
import {
  authorizeAdminSession,
  createSessionToken,
  getAdminMfaAccountKey,
  getAdminMfaClientKey,
  hashSessionToken,
  isSameOrigin,
} from "@/lib/admin-session";
import {
  decryptTotpSecret,
  generateAdminRecoveryCodes,
  getTotpCounterForCode,
  hashMagicLinkToken,
  hashOneTimeCode,
} from "@/lib/admin-mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHALLENGE_COOKIE = "admin_mfa_challenge";
const HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function clearChallengeCookie(response: NextResponse) {
  response.cookies.set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin/mfa",
    maxAge: 0,
  });
}

async function readBody(request: NextRequest): Promise<{ code?: unknown } | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024) return null;
  const raw = await request.text();
  if (raw.length > 1024) return null;
  try { return JSON.parse(raw) as { code?: unknown }; } catch { return null; }
}

/** Verify a one-time recovery code during a pending login challenge. */
export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const raw = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: "Authentication challenge expired" }, { status: 401, headers: HEADERS });
  const challengeHash = hashMagicLinkToken(raw);
  const body = await readBody(request);
  if (!body || typeof body.code !== "string" || !/^[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/i.test(body.code)) {
    return NextResponse.json({ error: "Enter a valid recovery code" }, { status: 400, headers: HEADERS });
  }

  const recoveryHash = hashOneTimeCode(body.code.replace(/-/g, "").toUpperCase(), "mfa-recovery");
  const clientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminMfaAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  const throttle = await getAdminAuthAttempts(clientKey, accountKey, 15 * 60);
  if (throttle.clientAttempts >= 5 || throttle.accountAttempts >= 5) {
    const response = NextResponse.json({ error: "Recovery verification temporarily locked. Sign in again later." }, {
      status: 429, headers: { ...HEADERS, "Retry-After": "900" },
    });
    clearChallengeCookie(response);
    return response;
  }
  if (!(await completeAdminMfaRecoveryChallenge(challengeHash, recoveryHash))) {
    await auditAdminAuthEvent(request, "recovery_code", false);
    const attempts = await recordAdminMfaChallengeFailure(challengeHash);
    const ipAttempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    const accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
    const locked = attempts >= 5 || ipAttempts > 5 || accountAttempts > 5;
    const response = NextResponse.json({ error: locked ? "Recovery verification temporarily locked. Sign in again later." : "Invalid or already used recovery code." }, {
      status: locked ? 429 : 401,
      headers: { ...HEADERS, ...(locked ? { "Retry-After": "900" } : {}) },
    });
    if (locked) clearChallengeCookie(response);
    return response;
  }

  await clearAdminAuthAttempts(clientKey);
  await clearAdminAuthAttempts(accountKey);
  await auditAdminAuthEvent(request, "recovery_code", true);
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

/** Regenerate all recovery codes after a fresh authenticator proof. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const session = request.cookies.get("admin_session")?.value;
  if (!(await authorizeAdminSession(session, getAdminSessionWithMfaPolicy))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  }
  const body = await readBody(request);
  if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Enter your current six-digit authenticator code" }, { status: 400, headers: HEADERS });
  }
  const credential = await getAdminTotpCredential();
  if (!credential?.enabled) return NextResponse.json({ error: "Authenticator is not enabled" }, { status: 409, headers: HEADERS });

  let counter: number | null = null;
  try {
    counter = getTotpCounterForCode(decryptTotpSecret(credential.encryptedSecret), body.code);
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  }
  const clientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminMfaAccountKey(process.env.ADMIN_USERNAME ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  const throttle = await getAdminAuthAttempts(clientKey, accountKey, 15 * 60);
  if (throttle.clientAttempts >= 5 || throttle.accountAttempts >= 5) {
    return NextResponse.json({ error: "Recovery-code management temporarily locked" }, {
      status: 429, headers: { ...HEADERS, "Retry-After": "900" },
    });
  }
  if (counter === null) {
    await auditAdminAuthEvent(request, "recovery_code", false);
    const ipAttempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    const accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
    const locked = ipAttempts > 5 || accountAttempts > 5;
    return NextResponse.json({ error: locked ? "Recovery-code management temporarily locked" : "Invalid authenticator code" }, {
      status: locked ? 429 : 401,
      headers: { ...HEADERS, ...(locked ? { "Retry-After": "900" } : {}) },
    });
  }

  const recoveryCodes = generateAdminRecoveryCodes(10);
  const hashes = recoveryCodes.map((code) => hashOneTimeCode(code.replace(/-/g, ""), "mfa-recovery"));
  if (!(await regenerateAdminRecoveryCodes(counter, hashes))) {
    await auditAdminAuthEvent(request, "recovery_code", false);
    await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
    return NextResponse.json({ error: "Authenticator code was already used. Wait for the next code and retry." }, { status: 409, headers: HEADERS });
  }
  await clearAdminAuthAttempts(clientKey);
  await clearAdminAuthAttempts(accountKey);
  await auditAdminAuthEvent(request, "recovery_code", true);
  return NextResponse.json({
    ok: true,
    recoveryCodes,
    message: "New recovery codes generated. All previous codes are now invalid.",
  }, { headers: HEADERS });
}
