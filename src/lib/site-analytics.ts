const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_HOST ?? "sarvodaya.dev").toLowerCase();
const BLOG_HOST = (process.env.NEXT_PUBLIC_BLOG_HOST ?? "blog.sarvodaya.dev").toLowerCase();

export type PageViewEvent = {
  path: string;
  referrerHost: string;
};

const MAX_PATH_LENGTH = 300;
const MAX_HOST_LENGTH = 253;
const INTERNAL_HOSTS = new Set([
  SITE_HOST,
  BLOG_HOST,
  `www.${SITE_HOST}`,
  `www.${BLOG_HOST}`,
]);

/** Accept only a same-site pathname. Query strings, fragments, and full URLs are never stored. */
export function normalizeAnalyticsPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PATH_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("?") ||
    value.includes("#")
  ) return null;

  let pathname: string;
  try {
    const parsed = new URL(value, "https://analytics.invalid");
    if (parsed.origin !== "https://analytics.invalid") return null;
    pathname = parsed.pathname;
  } catch {
    return null;
  }

  if (
    pathname.length > MAX_PATH_LENGTH ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-z0-9]{1,8}$/i.test(pathname)
  ) return null;

  return pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : "/";
}

export function normalizeReferrerHost(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "(direct)";
  if (typeof value !== "string" || value.length > MAX_HOST_LENGTH || value.includes("://")) return null;

  try {
    const parsed = new URL(`https://${value}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.hostname !== value.toLowerCase()
    ) return null;

    const host = parsed.hostname.toLowerCase();
    return INTERNAL_HOSTS.has(host) ? "(direct)" : host;
  } catch {
    return null;
  }
}

/** Whitelist the two fields accepted from the browser; no visitor or device identifiers are accepted. */
export function normalizePageViewEvent(input: unknown): PageViewEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "path" && key !== "referrerHost")) return null;

  const path = normalizeAnalyticsPath(record.path);
  const referrerHost = normalizeReferrerHost(record.referrerHost);
  if (!path || !referrerHost) return null;
  return { path, referrerHost };
}

export type AnalyticsDailyRow = { day: string; views: number };
export type AnalyticsBreakdownRow = { label: string; views: number };

export function summarizeAnalytics(
  daily: AnalyticsDailyRow[],
  topPages: AnalyticsBreakdownRow[],
  topReferrers: AnalyticsBreakdownRow[]
) {
  const safeDaily = daily.slice(-30).map((row) => ({
    day: String(row.day).slice(0, 10),
    views: Math.max(0, Math.min(2_147_483_647, Math.trunc(Number(row.views) || 0))),
  }));
  const safeBreakdown = (rows: AnalyticsBreakdownRow[]) => rows.slice(0, 10).map((row) => ({
    label: String(row.label).slice(0, 300),
    views: Math.max(0, Math.min(2_147_483_647, Math.trunc(Number(row.views) || 0))),
  }));
  return {
    totalViews: safeDaily.reduce((total, row) => total + row.views, 0),
    periodDays: 30,
    daily: safeDaily,
    topPages: safeBreakdown(topPages),
    topReferrers: safeBreakdown(topReferrers),
  };
}
