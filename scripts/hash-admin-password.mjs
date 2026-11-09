import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";

const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
if (password.length < 14 || password.length > 1024 || bcrypt.truncates(password)) {
  console.error("Password must contain 14–1024 characters and fit bcrypt's 72-byte UTF-8 limit.");
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
console.log(hash);
