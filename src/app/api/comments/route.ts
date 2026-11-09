import { NextRequest, NextResponse } from "next/server";
import { countRecentByIp, getApprovedComments, insertComment } from "@/lib/db";
import { getAllPosts } from "@/lib/posts";
import { createPublicComment, listPublicComments } from "@/lib/comment-service";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  const result = await listPublicComments(request.nextUrl.searchParams.get("slug"), {
    getApprovedComments,
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createPublicComment(
    body,
    clientIp(request),
    { countRecentByIp, insertComment },
    (slug) => getAllPosts().some((post) => post.slug === slug)
  );
  return NextResponse.json(result.body, { status: result.status });
}
