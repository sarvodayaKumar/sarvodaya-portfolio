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
    <SectionWrapper id="tech" subtitle="Stack" title="Tools I use">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {categories.map(([key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`relative overflow-hidden rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all ${
                active === key
                  ? "border border-cyan-400/30 text-cyan-200"
                  : "border border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {active === key && (
                <motion.span
                  layoutId="tech-tab"
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">{key}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={{ duration: 0.28 }}
              className="flex flex-wrap gap-3"
            >
              {activeSkills.map((skill, i) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04, type: "spring", stiffness: 220 }}
                  whileHover={{ scale: 1.08, y: -4 }}
                  className="cursor-default rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-[0_0_20px_rgba(34,211,238,0.05)] hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  {skill}
                </motion.span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SectionWrapper>
  );
}
