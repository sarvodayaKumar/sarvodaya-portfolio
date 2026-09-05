"use client";

import { motion } from "framer-motion";
import { ExternalLink, FolderGit2 } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";
import SkillIcon from "./SkillIcon";

export default function Projects() {
  return (
    <SectionWrapper id="projects" subtitle="Selected" title="Projects">
      <p className="mb-8 max-w-3xl text-[16px] leading-7 text-muted">
        Terraform providers, reusable Azure modules, delivery pipelines, and cloud-native application
        topology — the same themes as the day job, in public repositories.
      </p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {profile.projects.map((project, i) => (
          <motion.div
            key={project.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
          >
            <GlowCard href={project.url} className="h-full min-h-[220px] p-5">
              <div className="flex h-full flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <FolderGit2 size={20} className="text-accent" />
                  <ExternalLink size={14} className="text-muted" />
                </div>
                <h3 className="font-mono text-sm font-semibold text-foreground">{project.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{project.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent"
                    >
                      <SkillIcon name={tag} size={12} />
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
