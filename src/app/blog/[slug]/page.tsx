import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getAllPosts, getPost } from "@/lib/posts";
import SiteChrome from "@/components/SiteChrome";
import { postsIndexHref } from "@/lib/site";

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
  return {
    title: `${post.title} | Sarvodaya Kumar`,
    description: post.summary,
    alternates: { canonical: `https://blog.sarvodaya.dev/${slug}` },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const indexHref = postsIndexHref((await headers()).get("host") ?? "");

  return (
    <SiteChrome>
      <article className="relative z-10 mx-auto max-w-3xl px-6 pt-32 pb-24">
        <Link href={indexHref} className="text-sm text-zinc-500 transition hover:text-cyan-300">
          ← All posts
        </Link>
        <p className="mt-8 font-mono text-xs text-zinc-500">{post.date}</p>
        <h1 className="mt-3 font-[family-name:var(--font-syne)] text-4xl font-semibold text-white">
          {post.title}
        </h1>
        {post.summary && <p className="mt-4 text-lg text-zinc-400">{post.summary}</p>}
        <div className="blog-prose mt-10">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </SiteChrome>
  );
}
