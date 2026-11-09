import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { verifyAdminPassword } from "../src/lib/admin-session.ts";

test("administrator password verification accepts cost-12 bcrypt and rejects legacy or malformed hashes", async () => {
  const password = "correct horse battery staple 2026!";
  const hash = await bcrypt.hash(password, 12);
  assert.equal(await verifyAdminPassword(password, hash), true);
  assert.equal(await verifyAdminPassword("incorrect password", hash), false);
  assert.equal(await verifyAdminPassword(password, undefined), false);
  assert.equal(await verifyAdminPassword(password, "scrypt$65536$8$1$legacy$hash"), false);
});

test("administrator password verification rejects bcrypt truncation inputs", async () => {
  const password = "a".repeat(72);
  const hash = await bcrypt.hash(password, 12);
  assert.equal(await verifyAdminPassword(password, hash), true);
  assert.equal(await verifyAdminPassword("a".repeat(73), hash), false);
});
