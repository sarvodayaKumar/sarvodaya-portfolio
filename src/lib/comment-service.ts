export type CommentStore = {
  getApprovedComments: (postSlug: string) => Promise<unknown[]>;
  getAllComments: (status?: "pending" | "approved") => Promise<unknown[]>;
  countRecentByIp: (ip: string, seconds: number) => Promise<number>;
  insertComment: (input: { postSlug: string; name: string; message: string; ip: string }) => Promise<unknown>;
  setCommentApproved: (id: number, approved: boolean) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;
};

export type ApiResult = {
  status: number;
  body: Record<string, unknown>;
};

const COOLDOWN_SECONDS = 30;
const DAILY_LIMIT = 10;
const DAILY_SECONDS = 24 * 60 * 60;
const MAX_NAME_LEN = 80;
const MAX_MESSAGE_LEN = 2000;

export async function listPublicComments(
  slug: string | null,
  store: Pick<CommentStore, "getApprovedComments">
): Promise<ApiResult> {
  if (!slug) return { status: 400, body: { error: "slug is required" } };
  const comments = await store.getApprovedComments(slug);
  return { status: 200, body: { comments } };
}

export async function createPublicComment(
  input: unknown,
  ip: string,
  store: Pick<CommentStore, "countRecentByIp" | "insertComment">,
  isKnownPost: (slug: string) => boolean
): Promise<ApiResult> {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!slug || !name || !message) {
    return { status: 400, body: { error: "name and message are required" } };
  }
  if (name.length > MAX_NAME_LEN || message.length > MAX_MESSAGE_LEN) {
    return { status: 400, body: { error: "name or message is too long" } };
  }
  if (!isKnownPost(slug)) {
    return { status: 400, body: { error: "unknown post" } };
  }

  const recentCount = await store.countRecentByIp(ip, COOLDOWN_SECONDS);
  if (recentCount > 0) {
    return { status: 429, body: { error: "Please wait a bit before posting again." } };
  }

  const dailyCount = await store.countRecentByIp(ip, DAILY_SECONDS);
  if (dailyCount >= DAILY_LIMIT) {
    return { status: 429, body: { error: "You've reached the daily comment limit." } };
  }

  await store.insertComment({ postSlug: slug, name, message, ip });
  return {
    status: 201,
    body: { message: "Comment submitted — it will appear once approved." },
  };
}

export async function listModerationComments(
  authorized: boolean,
  status: string | null,
  store: Pick<CommentStore, "getAllComments">
): Promise<ApiResult> {
  if (!authorized) return { status: 401, body: { error: "Unauthorized" } };
  const filter = status === "pending" || status === "approved" ? status : undefined;
  const comments = await store.getAllComments(filter);
  return { status: 200, body: { comments } };
}

export async function moderateComment(
  input: unknown,
  authorized: boolean,
  store: Pick<CommentStore, "setCommentApproved" | "deleteComment">
): Promise<ApiResult> {
  if (!authorized) return { status: 401, body: { error: "Unauthorized" } };
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const id = Number(body.id);
  const action = body.action;

  if (!Number.isInteger(id) || (action !== "approve" && action !== "delete")) {
    return { status: 400, body: { error: "id and a valid action are required" } };
  }

  if (action === "approve") {
    await store.setCommentApproved(id, true);
  } else {
    await store.deleteComment(id);
  }
  return { status: 200, body: { ok: true } };
}
