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


export async function createAdminSession(tokenHash: string, expiresAt: Date, mfaVerified = false): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE expires_at <= now()`;
  await sql`
    INSERT INTO admin_sessions (token_hash, expires_at, mfa_verified)
    VALUES (${tokenHash}, ${expiresAt.toISOString()}, ${mfaVerified})
  `;
}

/** Every protected admin API requires an MFA-assured session, even during initial enrollment. */
export async function getAdminSessionWithMfaPolicy(tokenHash: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM admin_sessions AS sessions
    WHERE sessions.token_hash = ${tokenHash}
      AND sessions.expires_at > now()
      AND sessions.mfa_verified = true
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function createAdminMfaChallenge(tokenHash: string, expiresAt: Date, emailOtpAllowed = true): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_mfa_challenges WHERE expires_at <= now()`;
  await sql`INSERT INTO admin_mfa_challenges (token_hash, expires_at, email_otp_allowed) VALUES (${tokenHash}, ${expiresAt.toISOString()}, ${emailOtpAllowed})`;
}

export async function getValidAdminMfaChallenge(tokenHash: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`SELECT 1 FROM admin_mfa_challenges WHERE token_hash = ${tokenHash} AND expires_at > now() AND attempts < 5 LIMIT 1`;
  return rows.length === 1;
}

export async function recordAdminMfaChallengeFailure(tokenHash: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`UPDATE admin_mfa_challenges SET attempts = attempts + 1 WHERE token_hash = ${tokenHash} AND expires_at > now() RETURNING attempts`;
  return Number(rows[0]?.attempts ?? 5);
}

export async function consumeAdminMfaChallenge(tokenHash: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_mfa_challenges WHERE token_hash = ${tokenHash}`;
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

/** Read the independent IP and account throttles before accepting an MFA proof. */
export async function getAdminAuthAttempts(clientKey: string, accountKey: string, windowSeconds: number): Promise<{ clientAttempts: number; accountAttempts: number }> {
  const sql = getSql();
  const rows = await sql`
    SELECT client_key, attempts FROM admin_auth_attempts
    WHERE (client_key = ${clientKey} OR client_key = ${accountKey})
      AND window_started_at > now() - make_interval(secs => ${windowSeconds})
  `;
  return {
    clientAttempts: Number(rows.find((row) => row.client_key === clientKey)?.attempts ?? 0),
    accountAttempts: Number(rows.find((row) => row.client_key === accountKey)?.attempts ?? 0),
  };
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
export async function savePendingAdminTotpSecret(encryptedSecret: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO admin_mfa_credentials (admin_id, encrypted_secret, enabled, last_used_counter, pending_expires_at)
    VALUES ('primary', ${encryptedSecret}, false, -1, now() + INTERVAL '10 minutes')
    ON CONFLICT (admin_id) DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret,
      last_used_counter = -1, pending_attempts = 0, pending_expires_at = EXCLUDED.pending_expires_at, updated_at = now()
    WHERE admin_mfa_credentials.enabled = false
    RETURNING admin_id
  `;
  return rows.length === 1;
}

/** Activate enrollment only after the user proves possession of the authenticator. */
export async function enableAdminTotp(counter: number, recoveryCodeHashes: string[]): Promise<boolean> {
  if (!Number.isSafeInteger(counter) || counter < 0 || recoveryCodeHashes.length !== 10 || recoveryCodeHashes.some((hash) => !/^[a-f0-9]{64}$/i.test(hash))) return false;
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_mfa_credentials
    SET enabled = true, last_used_counter = ${counter}, recovery_code_hashes = ${recoveryCodeHashes}, pending_expires_at = NULL, updated_at = now()
    WHERE admin_id = 'primary' AND enabled = false AND pending_attempts < 5 AND pending_expires_at > now()
    RETURNING admin_id
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
/** Consume the challenge and TOTP time-step in one statement to prevent concurrent reuse. */
export async function completeAdminMfaChallenge(tokenHash: string, counter: number): Promise<boolean> {
  if (!Number.isSafeInteger(counter) || counter < 0) return false;
  const sql = getSql();
  const rows = await sql`
    WITH valid_challenge AS (
      SELECT token_hash FROM admin_mfa_challenges
      WHERE token_hash = ${tokenHash} AND expires_at > now() AND attempts < 5
      FOR UPDATE
    ),
    updated AS (
      UPDATE admin_mfa_credentials
      SET last_used_counter = ${counter}, updated_at = now()
      WHERE admin_id = 'primary' AND enabled = true AND last_used_counter < ${counter}
        AND EXISTS (SELECT 1 FROM valid_challenge)
      RETURNING admin_id
    ),
    consumed AS (
      DELETE FROM admin_mfa_challenges
      WHERE token_hash = ${tokenHash} AND EXISTS (SELECT 1 FROM updated)
      RETURNING token_hash
    )
    SELECT token_hash FROM consumed
  `;
  return rows.length === 1;
}

/** Bound guesses during authenticator enrollment; five failures expire the pending setup. */
export async function recordAdminTotpEnrollmentFailure(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_mfa_credentials
    SET pending_attempts = LEAST(pending_attempts + 1, 5), updated_at = now()
    WHERE admin_id = 'primary' AND enabled = false AND pending_expires_at > now()
    RETURNING pending_attempts
  `;
  return Number(rows[0]?.pending_attempts ?? 5);
}


/** Store a short-lived email OTP for an existing MFA login challenge; at most three sends. */
export async function createAdminEmailOtpChallenge(challengeHash: string, codeHash: string, expiresAt: Date): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO admin_email_otp_challenges (challenge_hash, code_hash, expires_at, attempts, sends)
    SELECT token_hash, ${codeHash}, ${expiresAt.toISOString()}, 0, 1
    FROM admin_mfa_challenges
    WHERE token_hash = ${challengeHash} AND expires_at > now() AND attempts < 5 AND email_otp_allowed = true
    ON CONFLICT (challenge_hash) DO UPDATE SET
      code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      sends = admin_email_otp_challenges.sends + 1
    WHERE admin_email_otp_challenges.sends < 3
    RETURNING challenge_hash
  `;
  return rows.length === 1;
}

export async function recordAdminEmailOtpFailure(challengeHash: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_email_otp_challenges
    SET attempts = LEAST(attempts + 1, 5)
    WHERE challenge_hash = ${challengeHash} AND expires_at > now()
    RETURNING attempts
  `;
  return Number(rows[0]?.attempts ?? 5);
}

/** Atomically consume both the email OTP and its parent MFA challenge. */
export async function consumeAdminEmailOtpChallenge(challengeHash: string, codeHash: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    WITH consumed_otp AS (
      DELETE FROM admin_email_otp_challenges
      WHERE challenge_hash = ${challengeHash}
        AND code_hash = ${codeHash}
        AND expires_at > now()
        AND attempts < 5
      RETURNING challenge_hash
    ),
    consumed_challenge AS (
      DELETE FROM admin_mfa_challenges
      WHERE token_hash = ${challengeHash}
        AND expires_at > now()
        AND attempts < 5
        AND EXISTS (SELECT 1 FROM consumed_otp)
      RETURNING token_hash
    )
    SELECT token_hash FROM consumed_challenge
  `;
  return rows.length === 1;
}


/** Persist only a peppered token digest and the exact origin that requested it. */
export async function createAdminEmailMagicLink(tokenHash: string, origin: string, expiresAt: Date): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_email_magic_links WHERE expires_at <= now()`;
  await sql`
    INSERT INTO admin_email_magic_links (token_hash, origin, expires_at)
    VALUES (${tokenHash}, ${origin}, ${expiresAt.toISOString()})
  `;
}

/** Single-use and origin-bound passwordless login token. */
export async function consumeAdminEmailMagicLink(tokenHash: string, origin: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM admin_email_magic_links
    WHERE token_hash = ${tokenHash} AND origin = ${origin} AND expires_at > now()
    RETURNING token_hash
  `;
  return rows.length === 1;
}


/** Re-issue recovery codes only after a fresh TOTP proof and counter advance. */
export async function regenerateAdminRecoveryCodes(counter: number, recoveryCodeHashes: string[]): Promise<boolean> {
  if (!Number.isSafeInteger(counter) || counter < 0 || recoveryCodeHashes.length !== 10 || recoveryCodeHashes.some((hash) => !/^[a-f0-9]{64}$/i.test(hash))) return false;
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_mfa_credentials
    SET recovery_code_hashes = ${recoveryCodeHashes}, last_used_counter = ${counter}, updated_at = now()
    WHERE admin_id = 'primary' AND enabled = true AND last_used_counter < ${counter}
    RETURNING admin_id
  `;
  return rows.length === 1;
}

/** Atomically consume a recovery code and its pending login challenge. */
export async function completeAdminMfaRecoveryChallenge(challengeHash: string, recoveryCodeHash: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    WITH valid_challenge AS (
      SELECT token_hash FROM admin_mfa_challenges
      WHERE token_hash = ${challengeHash} AND expires_at > now() AND attempts < 5
      FOR UPDATE
    ),
    consumed_code AS (
      UPDATE admin_mfa_credentials
      SET recovery_code_hashes = array_remove(recovery_code_hashes, ${recoveryCodeHash}), updated_at = now()
      WHERE admin_id = 'primary' AND enabled = true
        AND ${recoveryCodeHash} = ANY(recovery_code_hashes)
        AND EXISTS (SELECT 1 FROM valid_challenge)
      RETURNING admin_id
    ),
    consumed_challenge AS (
      DELETE FROM admin_mfa_challenges
      WHERE token_hash = ${challengeHash} AND EXISTS (SELECT 1 FROM consumed_code)
      RETURNING token_hash
    )
    SELECT token_hash FROM consumed_challenge
  `;
  return rows.length === 1;
}

/** Disable after a recent MFA-assured session plus password reauthentication. */
export async function disableAdminTotp(): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_mfa_credentials
    SET enabled = false, recovery_code_hashes = ARRAY[]::TEXT[], pending_expires_at = NULL, updated_at = now()
    WHERE admin_id = 'primary' AND enabled = true
    RETURNING admin_id
  `;
  return rows.length === 1;
}

export async function getRecentAdminMfaSession(tokenHash: string, maxAgeSeconds: number): Promise<boolean> {
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1 || maxAgeSeconds > 900) return false;
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM admin_sessions
    WHERE token_hash = ${tokenHash}
      AND mfa_verified = true
      AND expires_at > now()
      AND created_at > now() - make_interval(secs => ${maxAgeSeconds})
    LIMIT 1
  `;
  return rows.length === 1;
}

export async function revokeAllAdminSessions(): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_sessions`;
}


const ADMIN_AUTH_AUDIT_EVENTS = new Set([
  "password_sign_in", "totp_enrollment", "totp_challenge", "email_otp",
  "email_magic_link", "recovery_code", "mfa_disable", "session_logout",
]);

/** Persist only a bounded event label, keyed client digest, and outcome; never store secrets or OTP values. */
export async function recordAdminAuthAuditEvent(
  eventType: string,
  actorKey: string | null,
  success: boolean,
): Promise<void> {
  if (!ADMIN_AUTH_AUDIT_EVENTS.has(eventType)) return;
  if (actorKey !== null && !/^[a-f0-9]{64}$/i.test(actorKey)) return;
  const sql = getSql();
  await sql`
    INSERT INTO admin_auth_audit_events (event_type, actor_key, success)
    VALUES (${eventType}, ${actorKey}, ${success})
  `;
}
