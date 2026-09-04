"use client";

import { motion } from "framer-motion";
import { ExternalLink, FolderGit2 } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";

export default function Projects() {
  return (
    <SectionWrapper id="projects" subtitle="Selected" title="Work">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {profile.projects.map((project, i) => (
          <motion.div
            key={project.name}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.45 }}
          >
            <GlowCard href={project.url} className="h-full min-h-[220px] p-5">
              <div className="flex h-full flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <FolderGit2 size={20} className="text-cyan-300" />
                  <ExternalLink size={14} className="text-zinc-500" />
                </div>
                <h3 className="font-mono text-sm font-semibold text-white">{project.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                  {project.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-cyan-400/15 bg-cyan-400/5 px-2 py-0.5 font-mono text-xs text-cyan-200/80"
                    >
                      {tag}
                    </span>
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
