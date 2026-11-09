import test from "node:test";
import assert from "node:assert/strict";
import { sendAdminMagicLink, sendAdminMfaEmailCode } from "../src/lib/admin-email.ts";

async function withEmailEnvironment(run) {
  const keys = ["RESEND_API_KEY", "ADMIN_EMAIL_FROM", "ADMIN_USERNAME"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.ADMIN_EMAIL_FROM = "Portfolio Security <security@example.test>";
  process.env.ADMIN_USERNAME = "admin@example.test";
  try {
    await run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    globalThis.fetch = originalFetch;
  }
}

test("email OTP delivery uses only the configured administrator recipient", async () => {
  await withEmailEnvironment(async () => {
    let requestBody;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(init.headers.Authorization, "Bearer test-resend-key");
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "email_test_otp" }), { status: 200 });
    };
    assert.equal(await sendAdminMfaEmailCode("482913"), true);
    assert.deepEqual(requestBody.to, ["admin@example.test"]);
    assert.match(requestBody.text, /482913/);
  });
});

test("magic-link email delivery sends a one-time URL only through the provider adapter", async () => {
  await withEmailEnvironment(async () => {
    let requestBody;
    globalThis.fetch = async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "email_test_magic" }), { status: 200 });
    };
    const link = "https://example.test/admin/email-confirm#token=one-time-secret";
    assert.equal(await sendAdminMagicLink(link), true);
    assert.deepEqual(requestBody.to, ["admin@example.test"]);
    assert.ok(requestBody.text.includes(link));
  });
});

test("email delivery fails closed when provider configuration or delivery is unavailable", async () => {
  await withEmailEnvironment(async () => {
    delete process.env.RESEND_API_KEY;
    globalThis.fetch = async () => { throw new Error("must not call provider"); };
    assert.equal(await sendAdminMfaEmailCode("482913"), false);
    process.env.RESEND_API_KEY = "test-resend-key";
    globalThis.fetch = async () => new Response("provider error", { status: 503 });
    assert.equal(await sendAdminMagicLink("https://example.test/link#token=x"), false);
  });
});
