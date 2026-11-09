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
    else if (entry.name === "route.ts") files.push(path);
  }
  return files;
}

test("every API route is explicitly classified as private or public", async () => {
  const files = await routeFiles("src/app/api");
  const publicRoutes = new Set([
    "src/app/api/comments/route.ts",
    "src/app/api/admin/session/route.ts",
  ]);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (publicRoutes.has(file)) {
      assert.match(source, /PUBLIC API POLICY:/, `${file} must document its public access policy`);
      continue;
    }
    assert.match(source, /authorizeAdminSession/, `${file} must validate the administrator session`);
  }
  assert.deepEqual(files.map((file) => file.replaceAll("\\", "/")).sort(), [
    "src/app/api/admin/operations/route.ts",
    "src/app/api/admin/session/route.ts",
    "src/app/api/comments/moderate/route.ts",
    "src/app/api/comments/route.ts",
  ]);
});
