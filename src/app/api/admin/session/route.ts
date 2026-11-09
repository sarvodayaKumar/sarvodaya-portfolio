import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSession,
  getValidAdminSession,
  revokeAdminSession,
  recordFailedAdminAuthAttempt,
  clearAdminAuthAttempts,
} from "@/lib/db";
import {
  createSessionToken,
  hashSessionToken,
  isSameOrigin,
  verifyAdminToken,
  getAdminAuthClientKey,
  getAdminTokenFromBody,
} from "@/lib/admin-session";

export const runtime = "nodejs";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const AUTH_WINDOW_SECONDS = 15 * 60;
const MAX_FAILED_AUTH_ATTEMPTS = 5;
const AUTH_FAILURE = { error: "Unable to authenticate" };

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
  if (!token || !(await getValidAdminSession(hashSessionToken(token)))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientKey = getAdminAuthClientKey(request, process.env.ADMIN_TOKEN);
  if (!clientKey) {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const token = getAdminTokenFromBody(body);
  if (!token || !verifyAdminToken(token, process.env.ADMIN_TOKEN)) {
    try {
      const attempts = await recordFailedAdminAuthAttempt(clientKey, AUTH_WINDOW_SECONDS);
      if (attempts > MAX_FAILED_AUTH_ATTEMPTS) {
        return NextResponse.json(AUTH_FAILURE, {
          status: 429,
          headers: { "Retry-After": String(AUTH_WINDOW_SECONDS) },
        });
      }
    } catch {
      return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503 });
    }
    return NextResponse.json(AUTH_FAILURE, { status: 401 });
  }

  try {
    await clearAdminAuthAttempts(clientKey);
  } catch {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503 });
  }

  const sessionToken = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await createAdminSession(hashSessionToken(sessionToken), expiresAt);

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, sessionToken);
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) await revokeAdminSession(hashSessionToken(token));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: 0,
  });
  return response;
}
