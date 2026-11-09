import { NextRequest, NextResponse } from "next/server";
import { deleteComment, getAllComments, getValidAdminSession, setCommentApproved } from "@/lib/db";
import { listModerationComments, moderateComment } from "@/lib/comment-service";
import { hashSessionToken, isSameOrigin } from "@/lib/admin-session";

export const runtime = "nodejs";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("admin_session")?.value;
  return !!token && getValidAdminSession(hashSessionToken(token));
}

export async function GET(request: NextRequest) {
  const authorized = await isAuthorized(request);
  const result = await listModerationComments(
    authorized,
    request.nextUrl.searchParams.get("status"),
    { getAllComments }
  );
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const authorized = await isAuthorized(request);
  const body = await request.json().catch(() => null);
  const result = await moderateComment(body, authorized, {
    setCommentApproved,
    deleteComment,
  });
  return NextResponse.json(result.body, { status: result.status });
}
