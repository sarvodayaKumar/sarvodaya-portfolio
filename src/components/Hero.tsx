"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, Mail } from "lucide-react";
import { profile } from "@/data/profile";
import { GithubIcon, LinkedInIcon } from "./BrandIcons";
import Portrait from "./Portrait";
import ResumeLink from "./ResumeLink";

export default function Hero() {
  const [lineIndex, setLineIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentLine = profile.typingLines[lineIndex];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayText.length < currentLine.length) {
            setDisplayText(currentLine.slice(0, displayText.length + 1));
          } else {
            setTimeout(() => setIsDeleting(true), 2200);
          }
        } else if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setLineIndex((prev) => (prev + 1) % profile.typingLines.length);
        }
      },
      isDeleting ? 18 : 42
    );
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, lineIndex]);

  return (
    <section className="relative z-10 flex min-h-screen items-center px-6 pt-28 pb-16">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Portrait />

        <div className="space-y-8 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-stone-400">
              {profile.status}
            </p>
            <h1 className="font-[family-name:var(--font-syne)] text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-[4.4rem] lg:leading-[1.05]">
              {profile.name}
            </h1>
            <p className="mt-4 text-xl text-zinc-200">{profile.title}</p>
            <p className="mt-1 text-sm text-zinc-500">{profile.specialty}</p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mx-auto max-w-xl text-base leading-relaxed text-zinc-400 lg:mx-0"
          >
            {profile.tagline}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="font-mono text-sm text-stone-300"
          >
            <span className="text-zinc-600">Currently · </span>
            {displayText}
            <span className="animate-pulse text-stone-400">|</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {profile.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left"
              >
                <p className="font-[family-name:var(--font-syne)] text-lg text-white">{stat.value}</p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <ResumeLink className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-stone-200" />
            <a
              href="#experience"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
            >
              View experience
              <ArrowDown size={15} />
            </a>
            <a
              href={profile.links.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
            >
              <LinkedInIcon size={15} />
              LinkedIn
            </a>
            <a
              href={profile.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
            >
              <GithubIcon size={15} />
              GitHub
            </a>
            <a
              href={`mailto:${profile.links.email}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
            >
              <Mail size={15} />
              Email
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
