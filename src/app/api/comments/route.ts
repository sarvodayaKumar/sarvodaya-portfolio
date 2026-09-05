import { NextRequest, NextResponse } from "next/server";
import { countRecentByIp, getApprovedComments, insertComment } from "@/lib/db";
import { getAllPosts } from "@/lib/posts";

const COOLDOWN_SECONDS = 30;
const DAILY_LIMIT = 10;
const DAILY_SECONDS = 24 * 60 * 60;
const MAX_NAME_LEN = 80;
const MAX_MESSAGE_LEN = 2000;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  const comments = await getApprovedComments(slug);
  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!slug || !name || !message) {
    return NextResponse.json({ error: "name and message are required" }, { status: 400 });
  }
  if (name.length > MAX_NAME_LEN || message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "name or message is too long" }, { status: 400 });
  }
  if (!getAllPosts().some((post) => post.slug === slug)) {
    return NextResponse.json({ error: "unknown post" }, { status: 400 });
  }

  const ip = clientIp(request);

  const recentCount = await countRecentByIp(ip, COOLDOWN_SECONDS);
  if (recentCount > 0) {
    return NextResponse.json(
      { error: "Please wait a bit before posting again." },
      { status: 429 }
    );
  }

  const dailyCount = await countRecentByIp(ip, DAILY_SECONDS);
  if (dailyCount >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "You've reached the daily comment limit." },
      { status: 429 }
    );
  }

  await insertComment({ postSlug: slug, name, message, ip });
  return NextResponse.json(
    { message: "Comment submitted — it will appear once approved." },
    { status: 201 }
  );
}
