import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminSession } from "@/lib/admin-session";
import { getSiteAnalytics, getAdminSessionWithMfaPolicy } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const authorized = await authorizeAdminSession(token, getAdminSessionWithMfaPolicy);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  }

  try {
    const analytics = await getSiteAnalytics(30);
    return NextResponse.json({
      ...analytics,
      source: "First-party page-view aggregates",
      fetchedAt: new Date().toISOString(),
    }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Analytics data is temporarily unavailable." }, {
      status: 503,
      headers: HEADERS,
    });
  }
}
