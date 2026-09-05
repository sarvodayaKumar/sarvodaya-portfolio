"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { profile } from "@/data/profile";
import SectionWrapper from "./SectionWrapper";
import SkillIcon from "./SkillIcon";

const categories = Object.entries(profile.techStack) as [string, string[]][];

const featured = ["Go", "Azure", "Kubernetes", "Terraform", "Docker", "Helm", "Prometheus", "Git"];

export default function TechStack() {
  const [active, setActive] = useState(categories[0]?.[0] ?? "");
  const activeSkills = (profile.techStack as Record<string, string[]>)[active] ?? [];

  return (
    <SectionWrapper id="tech" subtitle="Stack" title="Tools in production">
      <p className="mb-8 max-w-3xl text-[16px] leading-7 text-muted">
        Daily languages and platforms for cloud backends: Go first, then Azure, Kubernetes, Terraform,
        and the monitoring and scanning that sit around a release.
      </p>

      <div className="mb-10 flex flex-wrap gap-3">
        {featured.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground"
          >
            <SkillIcon name={name} size={18} />
            {name}
          </span>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {categories.map(([key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`relative overflow-hidden rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all ${
                active === key
                  ? "border border-accent/30 text-accent"
                  : "border border-transparent text-muted hover:bg-card hover:text-foreground"
              }`}
            >
              {active === key && (
                <motion.span layoutId="tech-tab" className="absolute inset-0 bg-accent/10" />
              )}
              <span className="relative z-10">{key}</span>
            </button>
          ))}
        </div>
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {activeSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
                >
                  <SkillIcon name={skill} size={22} />
                  <span>{skill}</span>
                </span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SectionWrapper>
  );
}
