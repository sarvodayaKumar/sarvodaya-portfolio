"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, Mail, MapPin } from "lucide-react";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { GithubIcon, LinkedInIcon } from "./BrandIcons";
import Portrait from "./Portrait";
import ResumeLink from "./ResumeLink";

const lines = [
  "Go microservices on Azure",
  "Kubernetes, Helm, and CI/CD",
  "Terraform providers and IaC",
];

export default function Hero() {
  const [lineIndex, setLineIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentLine = lines[lineIndex];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayText.length < currentLine.length) {
            setDisplayText(currentLine.slice(0, displayText.length + 1));
          } else {
            setTimeout(() => setIsDeleting(true), 1800);
          }
        } else if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setLineIndex((prev) => (prev + 1) % lines.length);
        }
      },
      isDeleting ? 16 : 38
    );
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, lineIndex]);

  return (
    <section className="relative z-10 flex min-h-screen items-center px-6 pt-28 pb-16">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Portrait />

        <div className="space-y-7 text-center lg:text-left">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              {profile.status}
            </p>
            <h1 className="font-[family-name:var(--font-syne)] text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-[4.2rem] lg:leading-[1.05]">
              {profile.name}
            </h1>
            <p className="mt-4 text-xl text-foreground">{site.role}</p>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted lg:justify-start">
              <MapPin size={14} />
              {site.location} · Senior Development Engineer @ Calsoft
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mx-auto max-w-2xl text-lg leading-8 text-muted lg:mx-0"
          >
            {site.headline}
          </motion.p>
          <p className="mx-auto max-w-2xl text-[15px] leading-7 text-muted lg:mx-0">{site.pitch}</p>

          <p className="font-mono text-sm text-accent">
            {displayText}
            <span className="animate-pulse">|</span>
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {profile.stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-card px-3 py-3 text-left">
                <p className="font-[family-name:var(--font-syne)] text-lg text-foreground">{stat.value}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <ResumeLink className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90" />
            <a
              href="#experience"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-foreground transition hover:border-accent hover:text-accent"
            >
              Full experience
              <ArrowDown size={15} />
            </a>
            <a
              href={profile.links.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-foreground transition hover:border-accent"
            >
              <LinkedInIcon size={15} />
              LinkedIn
            </a>
            <a
              href={profile.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-foreground transition hover:border-accent"
            >
              <GithubIcon size={15} />
              GitHub
            </a>
            <a
              href={`mailto:${profile.links.email}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-foreground transition hover:border-accent"
            >
              <Mail size={15} />
              Email
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
