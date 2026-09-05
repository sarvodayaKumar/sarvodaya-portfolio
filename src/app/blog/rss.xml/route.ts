import { getAllPosts } from "@/lib/posts";
import { profile } from "@/data/profile";
import { BLOG_HOST } from "@/lib/site";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = getAllPosts();
  const siteUrl = `https://${BLOG_HOST}`;

  const items = posts
    .map((post) => {
      const url = `${siteUrl}/${post.slug}`;
      const pubDate = post.date ? new Date(post.date).toUTCString() : "";
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <description>${escapeXml(post.summary)}</description>
      <author>${escapeXml(profile.name)}</author>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(profile.name)} — Blog</title>
    <link>${siteUrl}</link>
    <description>Writing on Go, Terraform, Kubernetes, and platform engineering.</description>
    <language>en</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
