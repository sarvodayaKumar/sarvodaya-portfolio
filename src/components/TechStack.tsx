"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { profile } from "@/data/profile";
import SectionWrapper from "./SectionWrapper";

const categories = Object.entries(profile.techStack) as [string, string[]][];

export default function TechStack() {
  const [active, setActive] = useState(categories[0]?.[0] ?? "");
  const activeSkills = (profile.techStack as Record<string, string[]>)[active] ?? [];

  return (
    <SectionWrapper id="tech" subtitle="Stack" title="Tools in production">
      <p className="mb-8 max-w-3xl text-[16px] leading-7 text-muted">
        Daily languages and platforms for cloud backends: Go first, then Azure, Kubernetes, Terraform,
        and the monitoring and scanning that sit around a release.
      </p>
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
              className="flex flex-wrap gap-3"
            >
              {activeSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground"
                >
                  {skill}
                </span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SectionWrapper>
  );
}
