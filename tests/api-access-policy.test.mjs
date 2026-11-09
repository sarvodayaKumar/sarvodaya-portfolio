import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function routeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await routeFiles(path));
    else if (entry.name === "route.ts") files.push(path.replaceAll("\\", "/"));
  }
  return files;
}

test("every API route is explicitly classified as private or public", async () => {
  const files = await routeFiles("src/app/api");
  const publicRoutes = new Set([
    "src/app/api/comments/route.ts",
    "src/app/api/admin/session/route.ts",
    "src/app/api/admin/mfa/challenge/route.ts",
    "src/app/api/admin/mfa/email/route.ts",
    "src/app/api/admin/email-link/route.ts",
    "src/app/api/analytics/route.ts",
  ]);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (file === "src/app/api/comments/route.ts") {
      assert.match(source, /PUBLIC API POLICY:/);
      assert.match(source, /isSameOrigin/);
      assert.match(source, /content-length/);
      assert.match(source, /countRecentByIp/);
      continue;
    }
    if (file === "src/app/api/admin/mfa/challenge/route.ts") {
      assert.match(source, /getValidAdminMfaChallenge/);
      assert.match(source, /isSameOrigin/);
      assert.match(source, /completeAdminMfaChallenge/);
      continue;
    }
    if (file === "src/app/api/admin/mfa/email/route.ts") {
      assert.match(source, /getValidAdminMfaChallenge/);
      assert.match(source, /isSameOrigin/);
      assert.match(source, /consumeAdminEmailOtpChallenge/);
      assert.match(source, /createAdminSession/);
      continue;
    }
    if (file === "src/app/api/admin/email-link/route.ts") {
      assert.match(source, /isSameOrigin/);
      assert.match(source, /consumeAdminEmailMagicLink/);
      assert.match(source, /hashMagicLinkToken/);
      assert.match(source, /createAdminMfaChallenge/);
      continue;
    }
    if (file === "src/app/api/admin/session/route.ts") {
      assert.match(source, /PUBLIC AUTHENTICATION POLICY:/);
      assert.match(source, /isSameOrigin/);
      assert.match(source, /recordFailedAdminAuthAttempt/);
      continue;
    }
    if (file === "src/app/api/analytics/route.ts") {
      assert.match(source, /isSameOrigin/);
      assert.match(source, /consumeSiteAnalyticsIngestLimit/);
      continue;
    }
    assert.ok(!publicRoutes.has(file), `${file} must not be accidentally public`);
    assert.match(source, /authorizeAdminSession/, `${file} must validate the administrator session`);
  }
});
