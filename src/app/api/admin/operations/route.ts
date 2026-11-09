import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminSession } from "@/lib/admin-session";
import { getAdminSessionWithMfaPolicy } from "@/lib/db";
import { normalizeWorkflowRuns, summarizeWorkflowRuns } from "@/lib/admin-operations";

export const runtime = "nodejs";

const REPOSITORY = "sarvodayaKumar/sarvodaya-portfolio";
const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const authorized = await authorizeAdminSession(token, getAdminSessionWithMfaPolicy);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: RESPONSE_HEADERS });
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (process.env.GITHUB_READ_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_READ_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/actions/runs?per_page=8`,
      { headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "GitHub Actions data is temporarily unavailable.", source: "GitHub Actions API", fetchedAt: new Date().toISOString() },
        { status: 502, headers: RESPONSE_HEADERS }
      );
    }

    const payload: unknown = await response.json();
    const runs = normalizeWorkflowRuns(payload);
    return NextResponse.json(
      {
        source: "GitHub Actions API",
        fetchedAt: new Date().toISOString(),
        runs,
        summary: summarizeWorkflowRuns(runs),
      },
      { headers: RESPONSE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve GitHub Actions data right now.", source: "GitHub Actions API", fetchedAt: new Date().toISOString() },
      { status: 502, headers: RESPONSE_HEADERS }
    );
  }
}
