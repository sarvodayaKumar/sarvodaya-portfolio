import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAnalyticsPath,
  normalizePageViewEvent,
  normalizeReferrerHost,
  summarizeAnalytics,
} from "../src/lib/site-analytics.ts";

test("normalizes public page paths and removes trailing slashes", () => {
  assert.equal(normalizeAnalyticsPath("/"), "/");
  assert.equal(normalizeAnalyticsPath("/blog/go-context/"), "/blog/go-context");
  assert.equal(normalizeAnalyticsPath("/projects"), "/projects");
});

test("rejects private, API, asset, and query-bearing paths", () => {
  for (const path of [
    "/admin",
    "/admin/comments",
    "/api/analytics",
    "/_next/static/chunk.js",
    "/robots.txt",
    "/sitemap.xml",
    "/images/profile.png",
    "/blog/post?email=private@example.com",
    "/blog/post#section",
    "https://external.example/path",
    "//external.example/path",
  ]) assert.equal(normalizeAnalyticsPath(path), null, path);
});

test("normalizes only referrer hostnames and suppresses internal referrers", () => {
  assert.equal(normalizeReferrerHost(""), "(direct)");
  assert.equal(normalizeReferrerHost("blog.sarvodaya.dev"), "(direct)");
  assert.equal(normalizeReferrerHost("www.sarvodaya.dev"), "(direct)");
  assert.equal(normalizeReferrerHost("news.example.com"), "news.example.com");
  assert.equal(normalizeReferrerHost("https://news.example.com/path"), null);
  assert.equal(normalizeReferrerHost("news.example.com/path"), null);
  assert.equal(normalizeReferrerHost("news.example.com:443"), null);
});

test("page-view event accepts only bounded path and referrer fields", () => {
  assert.deepEqual(normalizePageViewEvent({
    path: "/blog/post",
    referrerHost: "news.example.com",
  }), { path: "/blog/post", referrerHost: "news.example.com" });
  assert.equal(normalizePageViewEvent({ path: "/blog/post", visitorId: "abc" }), null);
  assert.equal(normalizePageViewEvent({ path: "/admin" }), null);
  assert.equal(normalizePageViewEvent("invalid"), null);
});

test("analytics summary clamps values and limits displayed rows", () => {
  const summary = summarizeAnalytics(
    [{ day: "2026-11-09", views: "12" }, { day: "2026-11-10", views: -5 }],
    Array.from({ length: 12 }, (_, index) => ({ label: `/page-${index}`, views: index + 1 })),
    [{ label: "news.example.com", views: 4 }]
  );
  assert.equal(summary.totalViews, 12);
  assert.equal(summary.daily[1].views, 0);
  assert.equal(summary.topPages.length, 10);
  assert.equal(summary.periodDays, 30);
});
