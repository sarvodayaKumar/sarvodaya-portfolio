import { NextRequest, NextResponse } from "next/server";
import {
  createAdminEmailMagicLink,
  consumeAdminEmailMagicLink,
  createAdminMfaChallenge,
  createAdminSession,
  getAdminTotpCredential,
  recordFailedAdminAuthAttempt,
  revokeAdminSession,
} from "@/lib/db";
import {
  createEmailMagicLinkToken,
  hashMagicLinkToken,
} from "@/lib/admin-mfa";
import {
  createSessionToken,
  getAdminMfaAccountKey,
  getAdminMfaClientKey,
  hashSessionToken,
  isSameOrigin,
  safeEqual,
} from "@/lib/admin-session";
import { sendAdminMagicLink } from "@/lib/admin-email";
import { auditAdminAuthEvent } from "@/lib/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const GENERIC = { ok: true, message: "If the address is eligible, a sign-in link will be sent." };
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;
const LINK_TTL_SECONDS = 10 * 60;

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024) return NextResponse.json(GENERIC, { headers: HEADERS });
  const raw = await request.text();
  if (raw.length > 1024) return NextResponse.json(GENERIC, { headers: HEADERS });
  let body: { email?: unknown } | null = null;
  try { body = JSON.parse(raw) as { email?: unknown }; } catch { /* generic response */ }

  const configuredEmail = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const suppliedEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const clientKey = getAdminMfaClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  const accountKey = getAdminMfaAccountKey(configuredEmail ?? "primary", process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey || !accountKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });

  let attempts = 0;
  let accountAttempts = 0;
  try {
    attempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
    accountAttempts = await recordFailedAdminAuthAttempt(accountKey, 15 * 60);
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  }

  let issued = false;
  if (attempts <= 5 && accountAttempts <= 5 && configuredEmail && suppliedEmail && safeEqual(suppliedEmail, configuredEmail)) {
    try {
      const token = createEmailMagicLinkToken();
      const origin = new URL(request.url).origin;
      await createAdminEmailMagicLink(
        hashMagicLinkToken(token),
        origin,
        new Date(Date.now() + LINK_TTL_SECONDS * 1000),
      );
      const url = new URL("/admin/email-confirm", origin);
      url.hash = "token=" + token;
      issued = await sendAdminMagicLink(url.toString());
    } catch {
      // Keep the response indistinguishable from an ineligible address.
    }
  }

  await auditAdminAuthEvent(request, "email_magic_link", issued);
  return NextResponse.json(GENERIC, {
    status: attempts > 5 || accountAttempts > 5 ? 429 : 200,
    headers: { ...HEADERS, ...(attempts > 5 || accountAttempts > 5 ? { "Retry-After": "900" } : {}) },
  });
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  const raw = await request.text();
  if (raw.length > 1024) return NextResponse.json({ error: "Invalid request" }, { status: 413, headers: HEADERS });
  let body: { token?: unknown } | null = null;
  try { body = JSON.parse(raw) as { token?: unknown }; } catch { /* invalid token */ }
  const token = typeof body?.token === "string" ? body.token : "";
  if (token.length < 40 || token.length > 128) {
    return NextResponse.json({ error: "Sign-in link is invalid or expired" }, { status: 401, headers: HEADERS });
  }

  const origin = new URL(request.url).origin;
  let valid = false;
  try {
    valid = await consumeAdminEmailMagicLink(hashMagicLinkToken(token), origin);
  } catch {
    valid = false;
  }
  if (!valid) {
    await auditAdminAuthEvent(request, "email_magic_link", false);
    return NextResponse.json({ error: "Sign-in link is invalid, expired, or already used" }, { status: 401, headers: HEADERS });
  }
  await auditAdminAuthEvent(request, "email_magic_link", true);

  const credential = await getAdminTotpCredential().catch(() => null);
  const previousSession = request.cookies.get("admin_session")?.value;
  if (previousSession) await revokeAdminSession(hashSessionToken(previousSession));
  const response = NextResponse.json({ ok: true, mfaRequired: true }, { headers: HEADERS });
  response.cookies.set("admin_session", "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api", maxAge: 0,
  });
  response.cookies.set("admin_mfa_challenge", "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/admin/mfa", maxAge: 0,
  });
  if (credential?.enabled) {
    const challengeToken = createEmailMagicLinkToken();
    await createAdminMfaChallenge(
      hashMagicLinkToken(challengeToken),
      new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
    );
    response.cookies.set("admin_mfa_challenge", challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin/mfa",
      maxAge: CHALLENGE_TTL_SECONDS,
    });
  } else {
    const sessionToken = createSessionToken();
    await createAdminSession(hashSessionToken(sessionToken), new Date(Date.now() + SESSION_TTL_SECONDS * 1000), false);
    response.cookies.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api",
      maxAge: SESSION_TTL_SECONDS,
    });
  }
  return response;
}
