import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/admin-session";
import { consumeSiteAnalyticsIngestLimit, recordSitePageView } from "@/lib/db";
import { normalizePageViewEvent } from "@/lib/site-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: HEADERS });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2_048) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: HEADERS });
  }

  const rawBody = await request.text();
  if (rawBody.length > 2_048) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: HEADERS });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: HEADERS });
  }

  const event = normalizePageViewEvent(body);
  if (!event) {
    return NextResponse.json({ error: "Invalid page-view event" }, { status: 400, headers: HEADERS });
  }

  try {
    const requests = await consumeSiteAnalyticsIngestLimit(60);
    if (requests > 600) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { ...HEADERS, "Retry-After": "60" },
      });
    }
    await recordSitePageView(event.path, event.referrerHost);
    return new NextResponse(null, { status: 204, headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Analytics temporarily unavailable" }, { status: 503, headers: HEADERS });
  }
}
