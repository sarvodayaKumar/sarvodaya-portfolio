import { NextRequest, NextResponse } from "next/server";
import {
  enableAdminTotp, getAdminTotpCredential, getValidAdminSession,
  savePendingAdminTotpSecret,
} from "@/lib/db";
import { authorizeAdminSession, createSessionToken, hashSessionToken, isSameOrigin } from "@/lib/admin-session";
import {
  buildTotpUri, decryptTotpSecret, encryptTotpSecret, generateTotpSecret,
  getTotpCounterForCode,
} from "@/lib/admin-mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };
const SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

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
  return NextResponse.json({
    mode: "enrollment",
    enabled: credential?.enabled ?? false,
    pending: Boolean(credential && !credential.enabled),
  }, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  if (!(await signedIn(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  const credential = await getAdminTotpCredential();
  if (credential?.enabled) return NextResponse.json({ error: "Authenticator is already enabled" }, { status: 409, headers: HEADERS });
  let secret: string;
  try {
    secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    const saved = await savePendingAdminTotpSecret(encrypted);
    if (!saved) return NextResponse.json({ error: "Unable to start enrollment" }, { status: 409, headers: HEADERS });
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
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Enter a valid six-digit code" }, { status: 400, headers: HEADERS });
  }
  const credential = await getAdminTotpCredential();
  if (!credential || credential.enabled) return NextResponse.json({ error: "No pending authenticator enrollment" }, { status: 409, headers: HEADERS });
  try {
    const secret = decryptTotpSecret(credential.encryptedSecret);
    const counter = getTotpCounterForCode(secret, body.code);
    if (counter === null) return NextResponse.json({ error: "Invalid or expired authenticator code" }, { status: 401, headers: HEADERS });
    const enabled = await enableAdminTotp(counter);
    if (!enabled) return NextResponse.json({ error: "Enrollment expired. Start again." }, { status: 409, headers: HEADERS });
    return NextResponse.json({ ok: true, message: "Authenticator enabled. Sign in again to verify MFA." }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Unable to verify authenticator enrollment" }, { status: 503, headers: HEADERS });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  if (!(await signedIn(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  const body = await request.json().catch(() => null) as { code?: unknown; password?: unknown } | null;
  if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code) || typeof body.password !== "string") {
    return NextResponse.json({ error: "Password and current authenticator code are required" }, { status: 400, headers: HEADERS });
  }
  // Disabling MFA is deliberately not exposed until a dedicated reauthentication
  // and recovery policy is completed. This endpoint fails closed.
  return NextResponse.json({ error: "Authenticator removal is not available yet" }, { status: 501, headers: HEADERS });
}
