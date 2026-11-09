import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSession,
  getValidAdminSession,
  revokeAdminSession,
} from "@/lib/db";
import {
  createSessionToken,
  hashSessionToken,
  isSameOrigin,
  verifyAdminToken,
} from "@/lib/admin-session";

export const runtime = "nodejs";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

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

  const body = await request.json().catch(() => null);
  const token = body && typeof body.token === "string" ? body.token : "";
  if (token.length > 1024 || !verifyAdminToken(token, process.env.ADMIN_TOKEN)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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
