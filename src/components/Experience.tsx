"use client";

import { motion } from "framer-motion";
import { Briefcase, GitBranch } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";

type Role = {
  type?: string;
  role: string;
  company: string;
  period: string;
  focus: string;
  highlights: string[];
};

function Timeline({ items, oss }: { items: Role[]; oss?: boolean }) {
  if (!items.length) return null;

  return (
    <div className="relative space-y-8">
      <div className="absolute left-[19px] top-2 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-accent to-transparent md:block" />
      {items.map((job, i) => (
        <motion.article
          key={`${job.company}-${job.role}-${job.period}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.45 }}
          className="relative flex gap-6"
        >
          <div className="relative z-10 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-accent md:flex">
            {oss ? <GitBranch size={16} /> : <Briefcase size={16} />}
          </div>
          <GlowCard className="flex-1 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-foreground">
                    {job.role}
                  </h3>
                  {oss && (
                    <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                      Open source
                    </span>
                  )}
                </div>
                <p className="text-accent">{job.company}</p>
              </div>
              <span className="rounded-full border border-border bg-background px-3 py-1 font-mono text-xs text-muted">
                {job.period}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium leading-6 text-foreground">{job.focus}</p>
            <ul className="mt-4 space-y-3">
              {job.highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] leading-7 text-muted">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </GlowCard>
        </motion.article>
      ))}
    </div>
  );
}

export default function Experience() {
  const employment = profile.employment as Role[];
  const openSource = profile.openSource as Role[];

  return (
    <SectionWrapper id="experience" subtitle="Career" title="Experience">
      <p className="mb-10 max-w-3xl text-[16px] leading-7 text-muted">
        Full employment history and upstream work: Azure backends at Wipro, then Terraform provider
        engineering at Calsoft, with Sensu and Aqua Security in the open.
      </p>
      <div className="space-y-16">
        <div>
          <h3 className="mb-6 font-[family-name:var(--font-syne)] text-xl text-foreground">Employment</h3>
          <Timeline items={employment} />
        </div>
        <div>
          <h3 className="mb-6 font-[family-name:var(--font-syne)] text-xl text-foreground">Open source</h3>
          <Timeline items={openSource} oss />
        </div>
      </div>
    </SectionWrapper>
  );
}
