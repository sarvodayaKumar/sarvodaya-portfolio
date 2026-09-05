import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";
import { SITE_HOST, BLOG_HOST } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  return [
    {
      url: `https://${SITE_HOST}`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `https://${BLOG_HOST}`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: `https://${BLOG_HOST}/${post.slug}`,
      lastModified: post.date || undefined,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
