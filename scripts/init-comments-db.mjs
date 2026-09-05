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

console.log("comments table ready.");
