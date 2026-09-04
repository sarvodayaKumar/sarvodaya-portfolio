import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  published: boolean;
};

export type Post = PostMeta & {
  content: string;
};

function parseFile(filename: string): Post {
  const slug = filename.replace(/\.mdx?$/, "");
  const raw = readFileSync(path.join(BLOG_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: String(data.title ?? slug),
    date: String(data.date ?? ""),
    summary: String(data.summary ?? ""),
    published: data.published !== false,
    content,
  };
}

export function getAllPosts(includeDrafts = false): PostMeta[] {
  let files: string[] = [];
  try {
    files = readdirSync(BLOG_DIR).filter(
      (file) => file.endsWith(".md") && !file.startsWith("_")
    );
  } catch {
    return [];
  }

  return files
    .map((file) => parseFile(file))
    .filter((post) => includeDrafts || post.published)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ content: _content, ...meta }) => meta);
}

export function getPost(slug: string): Post | null {
  try {
    const files = readdirSync(BLOG_DIR).filter(
      (file) => file.endsWith(".md") && !file.startsWith("_")
    );
    const match = files.find((file) => file.replace(/\.mdx?$/, "") === slug);
    if (!match) return null;
    const post = parseFile(match);
    if (!post.published) return null;
    return post;
  } catch {
    return null;
  }
}
