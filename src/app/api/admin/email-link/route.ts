import { NextRequest, NextResponse } from "next/server";
import {
  createAdminEmailMagicLink,
  consumeAdminEmailMagicLink,
  createAdminMfaChallenge,
  createAdminSession,
  getAdminTotpCredential,
  recordFailedAdminAuthAttempt,
} from "@/lib/db";
import {
  createEmailMagicLinkToken,
  hashMagicLinkToken,
} from "@/lib/admin-mfa";
import {
  createSessionToken,
  getAdminAuthClientKey,
  hashSessionToken,
  isSameOrigin,
  safeEqual,
} from "@/lib/admin-session";
import { sendAdminMagicLink } from "@/lib/admin-email";

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
  const clientKey = getAdminAuthClientKey(request, process.env.ADMIN_AUTH_PEPPER);
  if (!clientKey) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });

  let attempts = 0;
  try {
    attempts = await recordFailedAdminAuthAttempt(clientKey, 15 * 60);
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503, headers: HEADERS });
  }

  if (attempts <= 5 && configuredEmail && suppliedEmail && safeEqual(suppliedEmail, configuredEmail)) {
    try {
      const token = createEmailMagicLinkToken();
      const origin = new URL(request.url).origin;
      await createAdminEmailMagicLink(
        hashMagicLinkToken(token),
        origin,
        new Date(Date.now() + LINK_TTL_SECONDS * 1000),
      );
      const url = new URL("/api/admin/email-link", origin);
      url.searchParams.set("token", token);
      await sendAdminMagicLink(url.toString());
    } catch {
      // Keep the response indistinguishable from an ineligible address.
    }
  }

  return NextResponse.json(GENERIC, {
    status: attempts > 5 ? 429 : 200,
    headers: { ...HEADERS, ...(attempts > 5 ? { "Retry-After": "900" } : {}) },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const origin = new URL(request.url).origin;
  let valid = false;
  if (token.length >= 40 && token.length <= 128) {
    try {
      valid = await consumeAdminEmailMagicLink(hashMagicLinkToken(token), origin);
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    return NextResponse.redirect(new URL("/admin/comments?auth=invalid", request.url), {
      headers: HEADERS,
    });
  }

  const credential = await getAdminTotpCredential().catch(() => null);
  const response = NextResponse.redirect(new URL("/admin/mfa", request.url), { headers: HEADERS });
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
