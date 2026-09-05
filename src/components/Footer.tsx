import Link from "next/link";
import { headers } from "next/headers";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { navUrls } from "@/lib/site";

export default async function Footer() {
  const { blogHref } = navUrls((await headers()).get("host") ?? "");

  return (
    <footer className="relative z-10 border-t border-border px-6 py-8 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="font-mono text-sm text-muted">
          © {new Date().getFullYear()} {profile.name}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted">
          <Link href={blogHref} className="hover:text-foreground">
            Blog
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <span className="max-w-md text-center sm:text-right">{site.role} — Go, Azure, Kubernetes, Terraform.</span>
        </div>
      </div>
    </footer>
  );
}
