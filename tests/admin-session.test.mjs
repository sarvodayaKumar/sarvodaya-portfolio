import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeAdminSession,
  createSessionToken,
  hashSessionToken,
  isSameOrigin,
  verifyAdminToken,
} from "../src/lib/admin-session.ts";

test("admin token comparison accepts only an exact configured token", () => {
  assert.equal(verifyAdminToken("correct-secret", "correct-secret"), true);
  assert.equal(verifyAdminToken("wrong-secret", "correct-secret"), false);
  assert.equal(verifyAdminToken("short", "correct-secret"), false);
  assert.equal(verifyAdminToken("anything", undefined), false);
});

test("session tokens are random URL-safe values and are stored as one-way hashes", () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(hashSessionToken(first), first);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
});

test("missing, expired, and revoked admin sessions are rejected", async () => {
  let lookedUpHash = "";
  const lookup = async (hash) => {
    lookedUpHash = hash;
    return false;
  };
  assert.equal(await authorizeAdminSession(undefined, lookup), false);
  assert.equal(lookedUpHash, "");
  assert.equal(await authorizeAdminSession("expired-session", lookup), false);
  assert.equal(lookedUpHash, hashSessionToken("expired-session"));
  assert.equal(await authorizeAdminSession("revoked-session", lookup), false);
  assert.equal(lookedUpHash, hashSessionToken("revoked-session"));
});

test("active admin sessions are accepted only when the persistent lookup succeeds", async () => {
  const token = "active-session";
  assert.equal(
    await authorizeAdminSession(token, async (hash) => hash === hashSessionToken(token)),
    true
  );
});

test("state-changing requests require an exact same-origin Origin header", () => {
  const sameOrigin = new Request("https://example.test/api/admin/session", {
    method: "POST",
    headers: { origin: "https://example.test" },
  });
  const foreignOrigin = new Request("https://example.test/api/admin/session", {
    method: "POST",
    headers: { origin: "https://attacker.test" },
  });
  const missingOrigin = new Request("https://example.test/api/admin/session", { method: "POST" });
  assert.equal(isSameOrigin(sameOrigin), true);
  assert.equal(isSameOrigin(foreignOrigin), false);
  assert.equal(isSameOrigin(missingOrigin), false);
});
