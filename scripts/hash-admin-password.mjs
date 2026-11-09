import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
if (password.length < 14 || password.length > 1024) {
  console.error("Password must contain 14–1024 characters.");
  process.exit(1);
}
const salt = randomBytes(16);
const key = scryptSync(password, salt, 64, {
  N: 65_536, r: 8, p: 1, maxmem: 128 * 1024 * 1024,
});
console.log(`scrypt$65536$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`);
