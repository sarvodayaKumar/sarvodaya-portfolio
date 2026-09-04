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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10">
          <p className="text-zinc-400">
            Notes on Go, Terraform, Kubernetes, and platform engineering will land here.
          </p>
          <Link
            href={indexHref}
            className="mt-5 inline-flex text-sm text-cyan-300 transition hover:text-white"
          >
            Open the blog →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.slug}
              href={postHref(host, post.slug)}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20"
            >
              <p className="font-mono text-xs text-zinc-500">{post.date}</p>
              <h3 className="mt-2 font-[family-name:var(--font-syne)] text-lg text-white">
                {post.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{post.summary}</p>
            </Link>
          ))}
          <Link href={indexHref} className="inline-flex text-sm text-cyan-300 hover:text-white">
            All posts →
          </Link>
        </div>
      )}
    </SectionWrapper>
  );
}
