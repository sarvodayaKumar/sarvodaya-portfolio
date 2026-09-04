"use client";

import { motion } from "framer-motion";
import { ExternalLink, GitPullRequest, GitBranch, CircleDot } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";

export default function Contributions() {
  return (
    <SectionWrapper
      id="contributions"
      subtitle="Open source"
      title="Upstream experience"
    >
      <p className="mb-8 max-w-3xl text-[15px] leading-7 text-zinc-400">
        I contribute upstream in Go to observability and security infrastructure —
        Sensu&apos;s monitoring engine and Aqua Security&apos;s Terraform provider.
        Work is done under{" "}
        <a
          href={profile.links.workGithub}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 hover:text-white"
        >
          @sarvodaya-kumar-26
        </a>
        .
      </p>
      <div className="space-y-4">
        {profile.contributions.map((contrib, i) => (
          <motion.div
            key={contrib.repo}
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, duration: 0.4 }}
          >
            <GlowCard className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  {"org" in contrib && contrib.org && (
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                      {contrib.org}
                    </p>
                  )}
                  <a
                    href={contrib.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-cyan-300 transition-colors hover:text-white"
                  >
                    <GitBranch size={14} />
                    {contrib.repo}
                    <ExternalLink size={12} />
                  </a>
                  <p className="mt-2 text-sm text-zinc-400">{contrib.focus}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contrib.prs.map((pr) => (
                    <motion.a
                      key={pr}
                      href={`${contrib.url}/pull/${pr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ y: -2, scale: 1.06 }}
                      className="inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 font-mono text-xs text-green-400"
                    >
                      <GitPullRequest size={10} />
                      #{pr}
                    </motion.a>
                  ))}
                  {contrib.issues?.map((issue) => (
                    <motion.a
                      key={issue}
                      href={`${contrib.url}/issues/${issue}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ y: -2, scale: 1.06 }}
                      className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 font-mono text-xs text-orange-400"
                    >
                      <CircleDot size={10} />
                      #{issue}
                    </motion.a>
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
