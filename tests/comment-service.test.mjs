import test from "node:test";
import assert from "node:assert/strict";
import {
  createPublicComment,
  listPublicComments,
  listModerationComments,
  moderateComment,
} from "../src/lib/comment-service.ts";

function makeStore(overrides = {}) {
  const calls = { counts: [], inserts: [], approvedLists: [], moderationLists: [], approvals: [], deletes: [] };
  const store = {
    getApprovedComments: async (slug) => { calls.approvedLists.push(slug); return [{ id: 1, postSlug: slug }]; },
    getAllComments: async (status) => { calls.moderationLists.push(status); return [{ id: 1, approved: status === "approved" }]; },
    countRecentByIp: async (ip, seconds) => { calls.counts.push({ ip, seconds }); return 0; },
    insertComment: async (input) => { calls.inserts.push(input); return { id: 1, ...input }; },
    setCommentApproved: async (id, approved) => { calls.approvals.push({ id, approved }); },
    deleteComment: async (id) => { calls.deletes.push(id); },
    ...overrides,
  };
  return { store, calls };
}

const knownPost = (slug) => slug === "known-post";

test("public comment listing rejects a missing slug", async () => {
  const { store } = makeStore();
  const result = await listPublicComments(null, store);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: "slug is required" });
});

test("public comment listing returns approved comments for the requested slug", async () => {
  const { store, calls } = makeStore();
  const result = await listPublicComments("known-post", store);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.comments, [{ id: 1, postSlug: "known-post" }]);
  assert.deepEqual(calls.approvedLists, ["known-post"]);
});

test("comment creation trims fields and stores a pending comment", async () => {
  const { store, calls } = makeStore();
  const result = await createPublicComment({ slug: " known-post ", name: " Alice ", message: " Hello " }, "203.0.113.10", store, knownPost);
  assert.equal(result.status, 201);
  assert.deepEqual(calls.inserts, [{ postSlug: "known-post", name: "Alice", message: "Hello", ip: "203.0.113.10" }]);
  assert.deepEqual(calls.counts, [{ ip: "203.0.113.10", seconds: 30 }, { ip: "203.0.113.10", seconds: 86400 }]);
});

test("comment creation rejects missing fields", async () => {
  const { store, calls } = makeStore();
  const result = await createPublicComment({ slug: "known-post", name: " ", message: "text" }, "ip", store, knownPost);
  assert.equal(result.status, 400);
  assert.equal(calls.inserts.length, 0);
  assert.equal(calls.counts.length, 0);
});

test("comment creation rejects fields over their limits", async () => {
  const { store } = makeStore();
  const tooLongName = await createPublicComment({ slug: "known-post", name: "n".repeat(81), message: "text" }, "ip", store, knownPost);
  const tooLongMessage = await createPublicComment({ slug: "known-post", name: "name", message: "m".repeat(2001) }, "ip", store, knownPost);
  assert.equal(tooLongName.status, 400);
  assert.equal(tooLongMessage.status, 400);
});

test("comment creation rejects unknown post slugs", async () => {
  const { store, calls } = makeStore();
  const result = await createPublicComment({ slug: "missing", name: "Alice", message: "Hello" }, "ip", store, knownPost);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: "unknown post" });
  assert.equal(calls.counts.length, 0);
});

test("comment creation enforces the cooldown limit", async () => {
  const { store, calls } = makeStore({ countRecentByIp: async () => 1 });
  const result = await createPublicComment({ slug: "known-post", name: "Alice", message: "Hello" }, "ip", store, knownPost);
  assert.equal(result.status, 429);
  assert.equal(calls.inserts.length, 0);
});

test("comment creation enforces the daily limit", async () => {
  const { store, calls } = makeStore({ countRecentByIp: async (_ip, seconds) => seconds === 30 ? 0 : 10 });
  const result = await createPublicComment({ slug: "known-post", name: "Alice", message: "Hello" }, "ip", store, knownPost);
  assert.equal(result.status, 429);
  assert.equal(calls.inserts.length, 0);
});

test("database errors during comment creation propagate to the route boundary", async () => {
  const { store } = makeStore({ countRecentByIp: async () => { throw new Error("database unavailable"); } });
  await assert.rejects(() => createPublicComment({ slug: "known-post", name: "Alice", message: "Hello" }, "ip", store, knownPost), /database unavailable/);
});

test("moderation listing rejects unauthenticated callers without querying storage", async () => {
  const { store, calls } = makeStore();
  const result = await listModerationComments(false, "pending", store);
  assert.equal(result.status, 401);
  assert.equal(calls.moderationLists.length, 0);
});

test("moderation listing applies only supported status filters", async () => {
  const { store, calls } = makeStore();
  const pending = await listModerationComments(true, "pending", store);
  const all = await listModerationComments(true, "unexpected", store);
  assert.equal(pending.status, 200);
  assert.equal(all.status, 200);
  assert.deepEqual(calls.moderationLists, ["pending", undefined]);
});

test("moderation approval validates input and approves the requested comment", async () => {
  const { store, calls } = makeStore();
  const invalid = await moderateComment({ id: "not-a-number", action: "approve" }, true, store);
  const valid = await moderateComment({ id: "42", action: "approve" }, true, store);
  assert.equal(invalid.status, 400);
  assert.equal(valid.status, 200);
  assert.deepEqual(calls.approvals, [{ id: 42, approved: true }]);
});

test("moderation delete removes the requested comment", async () => {
  const { store, calls } = makeStore();
  const result = await moderateComment({ id: 7, action: "delete" }, true, store);
  assert.equal(result.status, 200);
  assert.deepEqual(calls.deletes, [7]);
});

test("moderation mutation rejects unauthenticated callers and invalid actions", async () => {
  const { store, calls } = makeStore();
  const unauthorized = await moderateComment({ id: 1, action: "delete" }, false, store);
  const invalid = await moderateComment({ id: 1, action: "publish" }, true, store);
  assert.equal(unauthorized.status, 401);
  assert.equal(invalid.status, 400);
  assert.equal(calls.deletes.length, 0);
  assert.equal(calls.approvals.length, 0);
});

test("database errors during moderation propagate to the route boundary", async () => {
  const { store } = makeStore({ setCommentApproved: async () => { throw new Error("database unavailable"); } });
  await assert.rejects(() => moderateComment({ id: 3, action: "approve" }, true, store), /database unavailable/);
});
