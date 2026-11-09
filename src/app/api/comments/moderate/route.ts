import { NextRequest, NextResponse } from "next/server";
import { deleteComment, getAllComments, setCommentApproved } from "@/lib/db";
import { listModerationComments, moderateComment } from "@/lib/comment-service";

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const header = request.headers.get("authorization") || "";
  return header === "Bearer " + token;
}

export async function GET(request: NextRequest) {
  const result = await listModerationComments(
    isAuthorized(request),
    request.nextUrl.searchParams.get("status"),
    { getAllComments }
  );
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await moderateComment(body, isAuthorized(request), {
    setCommentApproved,
    deleteComment,
  });
  return NextResponse.json(result.body, { status: result.status });
}
