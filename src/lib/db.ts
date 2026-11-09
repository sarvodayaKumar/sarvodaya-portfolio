import { neon } from "@neondatabase/serverless";

// Resolve the connection lazily so importing API routes during a build
// does not require production database credentials.
function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for comment database operations");
  }
  return neon(connectionString);
}

export type Comment = {
  id: number;
  postSlug: string;
  name: string;
  message: string;
  approved: boolean;
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): Comment {
  return {
    id: row.id as number,
    postSlug: row.post_slug as string,
    name: row.name as string,
    message: row.message as string,
    approved: row.approved as boolean,
    createdAt: (row.created_at as Date | string) instanceof Date
      ? (row.created_at as Date).toISOString()
      : String(row.created_at),
  };
}

export async function getApprovedComments(postSlug: string): Promise<Comment[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, post_slug, name, message, approved, created_at
    FROM comments
    WHERE post_slug = ${postSlug} AND approved = true
    ORDER BY created_at ASC
  `;
  return rows.map(mapRow);
}

export async function getAllComments(status?: "pending" | "approved"): Promise<Comment[]> {
  const sql = getSql();
  const rows =
    status === "pending"
      ? await sql`SELECT id, post_slug, name, message, approved, created_at FROM comments WHERE approved = false ORDER BY created_at DESC`
      : status === "approved"
        ? await sql`SELECT id, post_slug, name, message, approved, created_at FROM comments WHERE approved = true ORDER BY created_at DESC`
        : await sql`SELECT id, post_slug, name, message, approved, created_at FROM comments ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function countRecentByIp(ip: string, seconds: number): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT count(*)::int AS count FROM comments
    WHERE ip = ${ip} AND created_at > now() - make_interval(secs => ${seconds})
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function insertComment(input: {
  postSlug: string;
  name: string;
  message: string;
  ip: string;
}): Promise<Comment> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO comments (post_slug, name, message, ip, approved)
    VALUES (${input.postSlug}, ${input.name}, ${input.message}, ${input.ip}, false)
    RETURNING id, post_slug, name, message, approved, created_at
  `;
  return mapRow(rows[0]);
}

export async function setCommentApproved(id: number, approved: boolean): Promise<void> {
  const sql = getSql();
  await sql`UPDATE comments SET approved = ${approved} WHERE id = ${id}`;
}

export async function deleteComment(id: number): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM comments WHERE id = ${id}`;
}

export async function createAdminSession(tokenHash: string, expiresAt: Date): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE expires_at <= now()`;
  await sql`
    INSERT INTO admin_sessions (token_hash, expires_at)
    VALUES (${tokenHash}, ${expiresAt.toISOString()})
  `;
}

export async function getValidAdminSession(tokenHash: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM admin_sessions
    WHERE token_hash = ${tokenHash} AND expires_at > now()
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function recordFailedAdminAuthAttempt(clientKey: string, windowSeconds: number): Promise<number> {
  const sql = getSql();
  await sql`DELETE FROM admin_auth_attempts WHERE window_started_at <= now() - make_interval(secs => ${windowSeconds})`;
  const rows = await sql`
    INSERT INTO admin_auth_attempts (client_key, window_started_at, attempts)
    VALUES (${clientKey}, now(), 1)
    ON CONFLICT (client_key) DO UPDATE SET
      attempts = CASE
        WHEN admin_auth_attempts.window_started_at <= now() - make_interval(secs => ${windowSeconds}) THEN 1
        ELSE admin_auth_attempts.attempts + 1
      END,
      window_started_at = CASE
        WHEN admin_auth_attempts.window_started_at <= now() - make_interval(secs => ${windowSeconds}) THEN now()
        ELSE admin_auth_attempts.window_started_at
      END
    RETURNING attempts
  `;
  return Number(rows[0]?.attempts ?? 1);
}

export async function clearAdminAuthAttempts(clientKey: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_auth_attempts WHERE client_key = ${clientKey}`;
}

export async function revokeAdminSession(tokenHash: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
}

/** One global short-window ingestion cap; it stores no IP or visitor identifier. */
export async function consumeSiteAnalyticsIngestLimit(windowSeconds: number): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO site_analytics_ingest_limits (bucket_key, window_started_at, requests)
    VALUES ('public', now(), 1)
    ON CONFLICT (bucket_key) DO UPDATE SET
      requests = CASE
        WHEN site_analytics_ingest_limits.window_started_at <= now() - make_interval(secs => ${windowSeconds}) THEN 1
        ELSE site_analytics_ingest_limits.requests + 1
      END,
      window_started_at = CASE
        WHEN site_analytics_ingest_limits.window_started_at <= now() - make_interval(secs => ${windowSeconds}) THEN now()
        ELSE site_analytics_ingest_limits.window_started_at
      END
    RETURNING requests
  `;
  return Number(rows[0]?.requests ?? 1);
}

/** Store only daily route/referrer aggregates, never individual events or visitor data. */
export async function recordSitePageView(path: string, referrerHost: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO site_analytics_daily (day, path, referrer_host, page_views)
    VALUES (CURRENT_DATE, ${path}, ${referrerHost}, 1)
    ON CONFLICT (day, path, referrer_host) DO UPDATE SET
      page_views = LEAST(site_analytics_daily.page_views + 1, 2147483647)
  `;
  await sql`DELETE FROM site_analytics_daily WHERE day < CURRENT_DATE - INTERVAL '90 days'`;
}

/** Return bounded 30-day aggregates for the authenticated dashboard. */
export async function getSiteAnalytics(days = 30) {
  const boundedDays = Math.max(1, Math.min(30, Math.trunc(days) || 30));
  const sql = getSql();
  const dailyRows = await sql`
    SELECT to_char(calendar.day, 'YYYY-MM-DD') AS day,
      COALESCE(SUM(analytics.page_views), 0)::int AS views
    FROM generate_series(
      CURRENT_DATE - ${boundedDays - 1},
      CURRENT_DATE,
      INTERVAL '1 day'
    ) AS calendar(day)
    LEFT JOIN site_analytics_daily AS analytics
      ON analytics.day = calendar.day::date
    GROUP BY calendar.day
    ORDER BY calendar.day ASC
  `;
  const pageRows = await sql`
    SELECT path AS label, SUM(page_views)::int AS views
    FROM site_analytics_daily
    WHERE day >= CURRENT_DATE - (${boundedDays - 1}) AND day <= CURRENT_DATE
    GROUP BY path
    ORDER BY views DESC, path ASC
    LIMIT 10
  `;
  const referrerRows = await sql`
    SELECT referrer_host AS label, SUM(page_views)::int AS views
    FROM site_analytics_daily
    WHERE day >= CURRENT_DATE - (${boundedDays - 1}) AND day <= CURRENT_DATE
    GROUP BY referrer_host
    ORDER BY views DESC, referrer_host ASC
    LIMIT 10
  `;
  const daily = dailyRows.map((row) => ({
    day: String(row.day),
    views: Number(row.views ?? 0),
  }));
  const topPages = pageRows.map((row) => ({
    label: String(row.label),
    views: Number(row.views ?? 0),
  }));
  const topReferrers = referrerRows.map((row) => ({
    label: String(row.label),
    views: Number(row.views ?? 0),
  }));
  return {
    totalViews: daily.reduce((total, row) => total + row.views, 0),
    periodDays: boundedDays,
    daily,
    topPages,
    topReferrers,
  };
}

/** Return the single administrator's encrypted TOTP credential, if configured. */
export async function getAdminTotpCredential(): Promise<{ encryptedSecret: string; enabled: boolean; lastUsedCounter: number } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT encrypted_secret, enabled, last_used_counter
    FROM admin_mfa_credentials WHERE admin_id = 'primary' LIMIT 1
  `;
  if (!rows.length) return null;
  return { encryptedSecret: String(rows[0].encrypted_secret), enabled: rows[0].enabled === true, lastUsedCounter: Number(rows[0].last_used_counter) };
}

/** Replace an unconfirmed enrollment secret; it grants no MFA assurance until confirmed. */
export async function savePendingAdminTotpSecret(encryptedSecret: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO admin_mfa_credentials (admin_id, encrypted_secret, enabled, last_used_counter)
    VALUES ('primary', ${encryptedSecret}, false, -1)
    ON CONFLICT (admin_id) DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret,
      enabled = false, last_used_counter = -1, updated_at = now()
  `;
}

/** Activate enrollment only after the user proves possession of the authenticator. */
export async function enableAdminTotp(counter: number): Promise<boolean> {
  if (!Number.isSafeInteger(counter) || counter < 0) return false;
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_mfa_credentials SET enabled = true, last_used_counter = ${counter}, updated_at = now()
    WHERE admin_id = 'primary' AND enabled = false RETURNING admin_id
  `;
  return rows.length === 1;
}

/** Atomic compare-and-set prevents the same TOTP time-step from being replayed. */
export async function consumeAdminTotpCounter(counter: number): Promise<boolean> {
  if (!Number.isSafeInteger(counter) || counter < 0) return false;
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_mfa_credentials SET last_used_counter = ${counter}, updated_at = now()
    WHERE admin_id = 'primary' AND enabled = true AND last_used_counter < ${counter}
    RETURNING admin_id
  `;
  return rows.length === 1;
}