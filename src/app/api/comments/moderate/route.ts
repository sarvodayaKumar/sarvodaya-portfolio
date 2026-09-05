import { NextRequest, NextResponse } from "next/server";
import { deleteComment, getAllComments, setCommentApproved } from "@/lib/db";

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${token}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = request.nextUrl.searchParams.get("status");
  const comments = await getAllComments(
    status === "pending" || status === "approved" ? status : undefined
  );
  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  const action = body?.action;

  if (!Number.isInteger(id) || (action !== "approve" && action !== "delete")) {
    return NextResponse.json({ error: "id and a valid action are required" }, { status: 400 });
  }

  if (action === "approve") {
    await setCommentApproved(id, true);
  } else {
    await deleteComment(id);
  }
  return NextResponse.json({ ok: true });
}
