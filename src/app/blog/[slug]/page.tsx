import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getAllPosts, getPost, getRelatedPosts } from "@/lib/posts";
import CommentSection from "@/components/CommentSection";
import SiteChrome from "@/components/SiteChrome";
import { profile } from "@/data/profile";
import { postHref, postsIndexHref } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post | Sarvodaya Kumar" };
  const url = `https://blog.sarvodaya.dev/${slug}`;
  return {
    title: `${post.title} | Sarvodaya Kumar`,
    description: post.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      url,
      publishedTime: post.date || undefined,
      authors: [profile.name],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const host = (await headers()).get("host") ?? "";
  const indexHref = postsIndexHref(host);
  const related = getRelatedPosts(post);
  const url = `https://blog.sarvodaya.dev/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date || undefined,
    dateModified: post.date || undefined,
    url,
    mainEntityOfPage: url,
    author: {
      "@type": "Person",
      name: profile.name,
      url: "https://sarvodaya.dev",
    },
  };

  return (
    <SiteChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="relative z-10 mx-auto max-w-3xl px-6 pt-32 pb-24">
        <Link href={indexHref} className="text-sm text-muted transition hover:text-accent">
          ← All posts
        </Link>
        <p className="mt-8 font-mono text-xs text-muted">{post.date}</p>
        <h1 className="mt-3 font-[family-name:var(--font-syne)] text-4xl font-semibold text-foreground">
          {post.title}
        </h1>
        {post.summary && <p className="mt-4 text-lg text-muted">{post.summary}</p>}
        <div className="blog-prose mt-10">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        {related.length > 0 && (
          <div className="mt-16 border-t border-border pt-10">
            <h2 className="mb-6 font-[family-name:var(--font-syne)] text-xl font-semibold text-foreground">
              Related posts
            </h2>
            <ul className="space-y-4">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={postHref(host, r.slug)}
                    className="block rounded-2xl border border-border bg-card p-5 transition hover:border-accent/40"
                  >
                    <p className="font-mono text-xs text-muted">{r.date}</p>
                    <h3 className="mt-1 font-[family-name:var(--font-syne)] text-lg text-foreground">
                      {r.title}
                    </h3>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <CommentSection slug={post.slug} />
      </article>
    </SiteChrome>
  );
}
