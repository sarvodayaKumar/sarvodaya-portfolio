import Link from "next/link";
import { headers } from "next/headers";
import { profile } from "@/data/profile";
import { navUrls } from "@/lib/site";

export default async function Footer() {
  const { blogHref } = navUrls((await headers()).get("host") ?? "");

  return (
    <footer className="relative z-10 border-t border-white/10 px-6 py-8 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="font-mono text-sm text-zinc-500">
          © {new Date().getFullYear()} {profile.name}. Built with Next.js.
        </p>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <Link href={blogHref} className="hover:text-zinc-300">
            Blog
          </Link>
          <span className="max-w-md text-center sm:text-right">
            Senior software engineer — distributed systems, observability, cloud platforms.
          </span>
        </div>
      </div>
    </footer>
  );
}
