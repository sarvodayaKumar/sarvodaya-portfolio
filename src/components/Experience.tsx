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

function Timeline({
  items,
  oss,
}: {
  items: Role[];
  oss?: boolean;
}) {
  if (!items.length) return null;

  return (
    <div className="relative space-y-8">
      <div className="absolute left-[19px] top-2 hidden h-[calc(100%-2rem)] w-px overflow-hidden md:block">
        <div className="h-full w-full bg-gradient-to-b from-cyan-400 via-indigo-400 to-transparent" />
      </div>

      {items.map((job, i) => (
        <motion.div
          key={`${job.company}-${job.role}-${job.period}`}
          initial={{ opacity: 0, x: -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.12, duration: 0.5 }}
          className="relative flex gap-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/50 bg-[#05080f] shadow-[0_0_18px_rgba(34,211,238,0.45)] md:flex"
          >
            {oss ? (
              <GitBranch size={16} className="text-cyan-300" />
            ) : (
              <Briefcase size={16} className="text-cyan-300" />
            )}
          </motion.div>

          <GlowCard className="flex-1 p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-white">
                    {job.role}
                  </h3>
                  {oss && (
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                      Open source
                    </span>
                  )}
                  {!oss && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      Resume
                    </span>
                  )}
                </div>
                <p className="text-cyan-300">{job.company}</p>
              </div>
              <span className="mt-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-zinc-400 sm:mt-0">
                {job.period}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-300">{job.focus}</p>
            <ul className="mt-4 space-y-2">
              {job.highlights.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  {item}
                </li>
              ))}
            </ul>
          </GlowCard>
        </motion.div>
      ))}
    </div>
  );
}

export default function Experience() {
  const employment = (
    "employment" in profile ? profile.employment : profile.experience.filter((job) => !("type" in job && job.type === "oss"))
  ) as Role[];
  const openSource = (
    "openSource" in profile ? profile.openSource : profile.experience.filter((job) => "type" in job && job.type === "oss")
  ) as Role[];

  return (
    <SectionWrapper id="experience" subtitle="Career" title="Experience">
      <div className="space-y-16">
        <div>
          <h3 className="mb-6 font-[family-name:var(--font-syne)] text-xl text-white">
            Employment
          </h3>
          <p className="mb-8 text-sm text-zinc-500">
            Pulled from the resume PDF. Updates automatically when the file changes.
          </p>
          <Timeline items={employment} />
        </div>

        <div>
          <h3 className="mb-6 font-[family-name:var(--font-syne)] text-xl text-white">
            Open source
          </h3>
          <p className="mb-8 text-sm text-zinc-500">
            Upstream work kept separately so resume sync never overwrites it.
          </p>
          <Timeline items={openSource} oss />
        </div>
      </div>
    </SectionWrapper>
  );
}
