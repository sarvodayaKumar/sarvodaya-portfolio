"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { profile } from "@/data/profile";
import ResumeLink from "./ResumeLink";
import ThemeToggle from "./ThemeToggle";

const sectionLinks = [
  { href: "#about", label: "About" },
  { href: "#expertise", label: "Work" },
  { href: "#experience", label: "Experience" },
  { href: "#contributions", label: "Open source" },
  { href: "#projects", label: "Projects" },
  { href: "#contact", label: "Contact" },
];

type NavbarProps = {
  homeHref?: string;
  blogHref?: string;
};

export default function Navbar({ homeHref = "/", blogHref = "/blog" }: NavbarProps) {
  const pathname = usePathname();
  const onHome = pathname === "/" && homeHref === "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    if (!onHome) return () => window.removeEventListener("scroll", onScroll);

    const ids = sectionLinks.map((l) => l.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [onHome]);

  const sectionHref = (hash: string) =>
    onHome ? hash : `${homeHref === "/" ? "" : homeHref}/${hash}`;
  const onBlog = pathname.startsWith("/blog") || blogHref === "/";

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-border bg-background/80 shadow-sm backdrop-blur-2xl" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={homeHref} className="group flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold tracking-wide text-foreground">
            SK
          </span>
          <span className="hidden text-sm text-muted group-hover:text-foreground sm:block">
            {profile.name.split(" ")[0]}
          </span>
        </Link>

        <ul className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 backdrop-blur-xl md:flex">
          {sectionLinks.map((link) => (
            <li key={link.href}>
              <a
                href={sectionHref(link.href)}
                className={`relative rounded-full px-3 py-1.5 text-sm transition-all ${
                  onHome && active === link.href ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {onHome && active === link.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-accent/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </a>
            </li>
          ))}
          <li>
            <Link
              href={blogHref}
              className={`relative rounded-full px-3 py-1.5 text-sm ${onBlog ? "text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {onBlog && <span className="absolute inset-0 rounded-full bg-accent/10" />}
              <span className="relative z-10">Blog</span>
            </Link>
          </li>
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <ResumeLink className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground" />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-muted hover:bg-card hover:text-foreground"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col gap-1 px-6 py-4">
              {sectionLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={sectionHref(link.href)}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-card hover:text-accent"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href={blogHref}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:text-accent"
                >
                  Blog
                </Link>
              </li>
              <li>
                <ResumeLink className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground" />
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
