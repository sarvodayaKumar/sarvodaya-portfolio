import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTotpUri,
  decodeBase32,
  decryptTotpSecret,
  encodeBase32,
  encryptTotpSecret,
  generateAdminRecoveryCodes,
  generateEmailOtp,
  generateTotpSecret,
  getTotpCounterForCode,
  hashMagicLinkToken,
  hashOneTimeCode,
  verifyOneTimeCode,
  verifyTotpCode,
} from "../src/lib/admin-mfa.ts";

test("Base32 encoding round-trips RFC test bytes", () => {
  const bytes = Buffer.from("foobar");
  assert.equal(encodeBase32(bytes), "MZXW6YTBOI");
  assert.deepEqual(decodeBase32("MZXW6YTBOI"), bytes);
  assert.throws(() => decodeBase32("not-valid!"));
});

test("TOTP secrets produce standard authenticator provisioning URIs", () => {
  const secret = generateTotpSecret();
  assert.equal(decodeBase32(secret).length, 20);
  const uri = new URL(buildTotpUri(secret, "admin@example.com"));
  assert.equal(uri.protocol, "otpauth:");
  assert.equal(uri.hostname, "totp");
  assert.equal(uri.searchParams.get("secret"), secret);
  assert.equal(uri.searchParams.get("algorithm"), "SHA1");
  assert.equal(uri.searchParams.get("digits"), "6");
  assert.equal(uri.searchParams.get("period"), "30");
});

test("RFC 6238 six-digit TOTP is verified only within the allowed clock window", () => {
  // RFC 6238 SHA-1 test vector at 59 seconds, truncated to six digits.
  const secret = encodeBase32(Buffer.from("12345678901234567890"));
  assert.equal(getTotpCounterForCode(secret, "287082", 59_000, 0), 1);
  assert.equal(getTotpCounterForCode(secret, "287083", 59_000, 0), null);
  assert.equal(verifyTotpCode(secret, "287082", 59_000, 0), true);
  assert.equal(verifyTotpCode(secret, "287083", 59_000, 0), false);
  assert.equal(verifyTotpCode(secret, "287082", 59_000, 1), true);
  assert.equal(verifyTotpCode(secret, "12", 59_000), false);
});

test("TOTP secret encryption authenticates ciphertext and requires a 256-bit key", () => {
  const key = "ab".repeat(32);
  const envelope = encryptTotpSecret("JBSWY3DPEHPK3PXP", key);
  assert.equal(decryptTotpSecret(envelope, key), "JBSWY3DPEHPK3PXP");
  assert.throws(() => decryptTotpSecret(envelope, "cd".repeat(32)));
  assert.throws(() => encryptTotpSecret("secret", "short"));
});

test("email OTPs are six digits and peppered hashes are purpose-bound", () => {
  const pepper = "test-pepper-".repeat(4);
  const code = generateEmailOtp();
  assert.match(code, /^\d{6}$/);
  const hash = hashOneTimeCode(code, "email-mfa", pepper);
  assert.equal(verifyOneTimeCode(code, hash, "email-mfa", pepper), true);
  assert.equal(verifyOneTimeCode(code, hash, "password-reset", pepper), false);
  assert.equal(verifyOneTimeCode("000000", hash, "email-mfa", pepper), false);
});

test("magic-link tokens are random and stored as one-way hashes", () => {
  const pepper = "test-magic-link-pepper-".repeat(2);
  const first = hashMagicLinkToken("token-one", pepper);
  const second = hashMagicLinkToken("token-two", pepper);
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("recovery codes are unique, high-entropy, and formatted for one-time use", () => {
  const codes = generateAdminRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) assert.match(code, /^[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/);
  assert.throws(() => generateAdminRecoveryCodes(11));
});
