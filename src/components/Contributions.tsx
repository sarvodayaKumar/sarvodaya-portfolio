"use client";

import { motion } from "framer-motion";
import { ExternalLink, GitPullRequest, GitBranch, CircleDot } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";

export default function Contributions() {
  return (
    <SectionWrapper id="contributions" subtitle="Open source" title="Upstream work">
      <p className="mb-8 max-w-3xl text-[16px] leading-7 text-muted">
        Go contributions to observability and cloud security infrastructure — Sensu&apos;s monitoring
        engine and Aqua Security&apos;s Terraform provider — under{" "}
        <a
          href={profile.links.workGithub}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          @sarvodaya-kumar-26
        </a>
        . PRs and issues below are the public trail.
      </p>
      <div className="space-y-4">
        {profile.contributions.map((contrib, i) => (
          <motion.div
            key={contrib.repo}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <GlowCard className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  {"org" in contrib && contrib.org && (
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                      {contrib.org}
                    </p>
                  )}
                  <a
                    href={contrib.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-accent hover:underline"
                  >
                    <GitBranch size={14} />
                    {contrib.repo}
                    <ExternalLink size={12} />
                  </a>
                  <p className="mt-2 text-sm leading-6 text-muted">{contrib.focus}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contrib.prs.map((pr) => (
                    <a
                      key={pr}
                      href={`${contrib.url}/pull/${pr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      <GitPullRequest size={10} />
                      #{pr}
                    </a>
                  ))}
                  {contrib.issues?.map((issue) => (
                    <a
                      key={issue}
                      href={`${contrib.url}/issues/${issue}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-700 dark:text-amber-400"
                    >
                      <CircleDot size={10} />
                      #{issue}
                    </a>
                  ))}
                </div>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
