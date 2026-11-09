import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { countRecentByIp, getApprovedComments, insertComment } from "@/lib/db";
import { getAllPosts } from "@/lib/posts";
import { createPublicComment, listPublicComments } from "@/lib/comment-service";
import { isSameOrigin } from "@/lib/admin-session";

// PUBLIC API POLICY: approved-comment reads and moderated public submissions only.
// Submission is same-origin, size-bounded, schema-validated, and rate-limited.
function clientIp(request: NextRequest): string | null {
  const raw = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
  const ip = raw?.split(",")[0]?.trim();
  return ip && isIP(ip) !== 0 ? ip : null;
}

export async function GET(request: NextRequest) {
  const result = await listPublicComments(request.nextUrl.searchParams.get("slug"), {
    getApprovedComments,
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4096) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 4096) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ip = clientIp(request);
  if (!ip) return NextResponse.json({ error: "Submission temporarily unavailable" }, { status: 503 });
  try {
    const result = await createPublicComment(
      body,
      ip,
      { countRecentByIp, insertComment },
      (slug) => getAllPosts().some((post) => post.slug === slug)
    );
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to submit comment" }, { status: 503 });
  }
}
