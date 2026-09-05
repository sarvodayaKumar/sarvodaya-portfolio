import { neon } from "@neondatabase/serverless";

// Set by Vercel when a Postgres (Neon) database is provisioned and linked
// to this project, or by pulling env vars locally with `vercel env pull`.
const sql = neon(process.env.DATABASE_URL || "");

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
  const rows = await sql`
    SELECT id, post_slug, name, message, approved, created_at
    FROM comments
    WHERE post_slug = ${postSlug} AND approved = true
    ORDER BY created_at ASC
  `;
  return rows.map(mapRow);
}

export async function getAllComments(status?: "pending" | "approved"): Promise<Comment[]> {
  const rows =
    status === "pending"
      ? await sql`SELECT id, post_slug, name, message, approved, created_at FROM comments WHERE approved = false ORDER BY created_at DESC`
      : status === "approved"
        ? await sql`SELECT id, post_slug, name, message, approved, created_at FROM comments WHERE approved = true ORDER BY created_at DESC`
        : await sql`SELECT id, post_slug, name, message, approved, created_at FROM comments ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function countRecentByIp(ip: string, seconds: number): Promise<number> {
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
  const rows = await sql`
    INSERT INTO comments (post_slug, name, message, ip, approved)
    VALUES (${input.postSlug}, ${input.name}, ${input.message}, ${input.ip}, false)
    RETURNING id, post_slug, name, message, approved, created_at
  `;
  return mapRow(rows[0]);
}

export async function setCommentApproved(id: number, approved: boolean): Promise<void> {
  await sql`UPDATE comments SET approved = ${approved} WHERE id = ${id}`;
}

export async function deleteComment(id: number): Promise<void> {
  await sql`DELETE FROM comments WHERE id = ${id}`;
}
