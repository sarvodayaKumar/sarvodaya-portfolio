import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getAllPosts } from "@/lib/posts";
import SiteChrome from "@/components/SiteChrome";
import { postHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog | Sarvodaya Kumar",
  description: "Writing on Go, Terraform, Kubernetes, and platform engineering.",
  alternates: { canonical: "https://blog.sarvodaya.dev" },
};

export default async function BlogIndexPage() {
  const host = (await headers()).get("host") ?? "";
  const posts = getAllPosts();

  return (
    <SiteChrome>
      <main className="relative z-10 mx-auto max-w-3xl px-6 pt-32 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent">
          Writing
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-syne)] text-4xl font-semibold text-foreground">
          Blog
        </h1>
        <p className="mt-4 text-muted">
          Short posts on Go backends, Azure, Kubernetes, and Terraform.
        </p>

        {posts.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-border bg-card px-6 py-12">
            <p className="text-foreground">No posts yet.</p>
            <p className="mt-2 text-sm text-muted">
              Add a Markdown file under <code>content/blog/</code> with frontmatter and set{" "}
              <code>published: true</code>.
            </p>
          </div>
        ) : (
          <ul className="mt-12 space-y-4">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={postHref(host, post.slug)}
                  className="block rounded-2xl border border-border bg-card p-6 transition hover:border-accent/40"
                >
                  <p className="font-mono text-xs text-muted">{post.date}</p>
                  <h2 className="mt-2 font-[family-name:var(--font-syne)] text-xl text-foreground">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{post.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </SiteChrome>
  );
}
