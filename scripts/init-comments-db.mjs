// One-time setup: run `node scripts/init-comments-db.mjs` after provisioning
// a Postgres database and setting DATABASE_URL (locally via `vercel env pull`,
// or export it directly in your shell).
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Provision a Postgres database in Vercel first,");
  console.error("then run `vercel env pull .env.local` or export DATABASE_URL yourself.");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    ip TEXT,
    approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS comments_post_slug_idx ON comments (post_slug)`;
await sql`CREATE INDEX IF NOT EXISTS comments_ip_created_idx ON comments (ip, created_at)`;
await sql`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at)`;
await sql`
  CREATE TABLE IF NOT EXISTS admin_auth_attempts (
    client_key CHAR(64) PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  )
`;
await sql`CREATE INDEX IF NOT EXISTS admin_auth_attempts_window_idx ON admin_auth_attempts (window_started_at)`;
await sql`
  CREATE TABLE IF NOT EXISTS site_analytics_daily (
    day DATE NOT NULL,
    path TEXT NOT NULL,
    referrer_host TEXT NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 0 CHECK (page_views >= 0),
    PRIMARY KEY (day, path, referrer_host)
  )
`;
await sql`CREATE INDEX IF NOT EXISTS site_analytics_daily_day_idx ON site_analytics_daily (day DESC)`;
await sql`
  CREATE TABLE IF NOT EXISTS site_analytics_ingest_limits (
    bucket_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0
  )
`;
await sql`DELETE FROM admin_sessions WHERE expires_at <= now()`;
await sql`DELETE FROM site_analytics_daily WHERE day < CURRENT_DATE - INTERVAL '90 days'`;

console.log("comments, admin_sessions, admin_auth_attempts, and site_analytics tables ready.");
