import Link from "next/link";
import { headers } from "next/headers";
import { getAllPosts } from "@/lib/posts";
import SectionWrapper from "./SectionWrapper";
import { postsIndexHref, postHref } from "@/lib/site";

export default async function BlogTeaser() {
  const host = (await headers()).get("host") ?? "";
  const posts = getAllPosts();
  const indexHref = postsIndexHref(host);

  return (
    <SectionWrapper id="blog" subtitle="Writing" title="Blog">
      {posts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-10">
          <p className="text-muted">
            Notes on Go backends, Terraform providers, Kubernetes, and Azure platforms will land here.
          </p>
          <Link href={indexHref} className="mt-5 inline-flex text-sm text-accent hover:underline">
            Open the blog →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.slug}
              href={postHref(host, post.slug)}
              className="block rounded-2xl border border-border bg-card p-5 transition hover:border-accent/40"
            >
              <p className="font-mono text-xs text-muted">{post.date}</p>
              <h3 className="mt-2 font-[family-name:var(--font-syne)] text-lg text-foreground">
                {post.title}
              </h3>
              <p className="mt-2 text-sm text-muted">{post.summary}</p>
            </Link>
          ))}
          <Link href={indexHref} className="inline-flex text-sm text-accent hover:underline">
            All posts →
          </Link>
        </div>
      )}
    </SectionWrapper>
  );
}
