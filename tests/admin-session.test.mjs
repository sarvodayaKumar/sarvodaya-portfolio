import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  authorizeAdminSession, createSessionToken, hashSessionToken,
  getAdminAuthAccountKey, getAdminAuthClientKey, getAdminCredentialsFromBody, isSameOrigin,
  safeEqual, verifyAdminPassword,
} from "../src/lib/admin-session.ts";

async function passwordHash(password) {
  return bcrypt.hash(password, 12);
}

test("credential parsing rejects malformed login payloads", () => {
  assert.equal(getAdminCredentialsFromBody(null), null);
  assert.equal(getAdminCredentialsFromBody([]), null);
  assert.equal(getAdminCredentialsFromBody({ username: "admin" }), null);
  assert.equal(getAdminCredentialsFromBody({ username: 4, password: "secret" }), null);
  assert.equal(getAdminCredentialsFromBody({ username: "admin", password: "x".repeat(1025) }), null);
  assert.deepEqual(getAdminCredentialsFromBody({ username: " admin ", password: "passphrase" }), { username: "admin", password: "passphrase" });
});

test("username comparisons are constant-time and exact", () => {
  assert.equal(safeEqual("admin@example.test", "admin@example.test"), true);
  assert.equal(safeEqual("admin", "Admin"), false);
  assert.equal(safeEqual("short", "a-longer-value"), false);
});

test("bcrypt password hashes verify and legacy scrypt hashes fail closed", async () => {
  const encoded = await passwordHash("a-very-long-and-strong-test-password");
  assert.equal(await verifyAdminPassword("a-very-long-and-strong-test-password", encoded), true);
  assert.equal(await verifyAdminPassword("wrong-password", encoded), false);
  assert.equal(await verifyAdminPassword("a-very-long-and-strong-test-password", undefined), false);
  assert.equal(await verifyAdminPassword("password", "scrypt$1$1$1$bad$bad"), false);
});

test("account lockout keys are stable, keyed, and do not expose the account identifier", () => {
  const pepper = "p".repeat(32);
  const first = getAdminAuthAccountKey("Admin@Example.Test", pepper);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, getAdminAuthAccountKey("admin@example.test", pepper));
  assert.notEqual(first, getAdminAuthAccountKey("other@example.test", pepper));
  assert.equal(getAdminAuthAccountKey("admin@example.test", "short"), null);
});

test("admin auth client keys require a strong pepper and validated trusted proxy IP", () => {
  const request = new Request("https://example.test/api/admin/session", { headers: { "x-vercel-forwarded-for": "203.0.113.8" } });
  const key = getAdminAuthClientKey(request, "p".repeat(32));
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(getAdminAuthClientKey(request, "short"), null);
  assert.equal(getAdminAuthClientKey(request, undefined), null);
  const spoofable = new Request("https://example.test/api/admin/session", { headers: { "x-forwarded-for": "203.0.113.8" } });
  assert.equal(getAdminAuthClientKey(spoofable, "p".repeat(32)), null);
});

test("session tokens are random URL-safe values and stored as one-way hashes", () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(hashSessionToken(first), first);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
});

test("missing, expired, and revoked admin sessions are rejected", async () => {
  let lookedUpHash = "";
  const lookup = async (hash) => { lookedUpHash = hash; return false; };
  assert.equal(await authorizeAdminSession(undefined, lookup), false);
  assert.equal(lookedUpHash, "");
  assert.equal(await authorizeAdminSession("expired-session", lookup), false);
  assert.equal(lookedUpHash, hashSessionToken("expired-session"));
});

test("active admin sessions require successful persistent lookup", async () => {
  const token = "active-session";
  assert.equal(await authorizeAdminSession(token, async (hash) => hash === hashSessionToken(token)), true);
});

test("state-changing requests require an exact same-origin Origin header", () => {
  const same = new Request("https://example.test/api/admin/session", { method: "POST", headers: { origin: "https://example.test" } });
  const foreign = new Request("https://example.test/api/admin/session", { method: "POST", headers: { origin: "https://attacker.test" } });
  const missing = new Request("https://example.test/api/admin/session", { method: "POST" });
  assert.equal(isSameOrigin(same), true);
  assert.equal(isSameOrigin(foreign), false);
  assert.equal(isSameOrigin(missing), false);
});
