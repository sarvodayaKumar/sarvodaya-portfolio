import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

export function encodeBase32(input: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) throw new Error("Invalid Base32 secret");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of normalized) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function buildTotpUri(secret: string, account: string, issuer = "Sarvodaya Portfolio"): string {
  if (!account.trim() || !secret.trim()) throw new Error("Account and secret are required");
  const label = encodeURIComponent(`${issuer}:${account}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

function totpAt(secret: Uint8Array, counter: number): string {
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

/** Return the matched RFC 6238 time-step so callers can atomically prevent replay. */
export function getTotpCounterForCode(secret: string, code: string, now = Date.now(), window = 1): number | null {
  if (!/^\d{6}$/.test(code) || !Number.isFinite(now) || !Number.isInteger(window) || window < 0 || window > 1) return null;
  let key: Buffer;
  try { key = decodeBase32(secret); } catch { return null; }
  if (key.length < 16) return null;
  const counter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  const candidate = Buffer.from(code);
  let matchedCounter: number | null = null;
  for (let offset = -window; offset <= window; offset += 1) {
    const step = counter + offset;
    if (step < 0) continue;
    const expected = Buffer.from(totpAt(key, step));
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) matchedCounter = step;
  }
  return matchedCounter;
}

/** RFC 6238 SHA-1 TOTP with a bounded +/- one-step clock-skew window. */
export function verifyTotpCode(secret: string, code: string, now = Date.now(), window = 1): boolean {
  return getTotpCounterForCode(secret, code, now, window) !== null;
}

function getEncryptionKey(keyHex = process.env.ADMIN_TOTP_ENCRYPTION_KEY): Buffer {
  if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) {
    throw new Error("ADMIN_TOTP_ENCRYPTION_KEY must be a 32-byte hexadecimal key");
  }
  return Buffer.from(keyHex, "hex");
}

/** AES-256-GCM envelope: v1.iv.tag.ciphertext (base64url). */
export function encryptTotpSecret(secret: string, keyHex?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTotpSecret(envelope: string, keyHex?: string): string {
  const [version, ivPart, tagPart, ciphertextPart, extra] = envelope.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart || extra !== undefined) {
    throw new Error("Invalid encrypted TOTP secret");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > 256) throw new Error("Invalid encrypted TOTP secret");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(keyHex), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function generateEmailOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Use a server-only pepper so a database-only disclosure cannot verify short OTPs offline. */
export function hashOneTimeCode(code: string, purpose: string, pepper = process.env.ADMIN_AUTH_PEPPER): string {
  if (!pepper || pepper.length < 32) throw new Error("ADMIN_AUTH_PEPPER must contain at least 32 characters");
  if (!/^[a-z0-9_-]{1,32}$/i.test(purpose)) throw new Error("Invalid one-time-code purpose");
  return createHmac("sha256", pepper).update(`${purpose}: ${code}`).digest("hex");
}

export function verifyOneTimeCode(code: string, expectedHash: string, purpose: string, pepper?: string): boolean {
  if (!/^[0-9]{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  try {
    const candidate = Buffer.from(hashOneTimeCode(code, purpose, pepper), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function createEmailMagicLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashMagicLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
