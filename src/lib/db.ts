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

export async function revokeAdminSession(tokenHash: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
}
