"use client";

import { motion } from "framer-motion";
import { profile } from "@/data/profile";
import SectionWrapper from "./SectionWrapper";

const yamlLines = [
  { k: "role", v: profile.currentFocus.role },
  { k: "focus", v: profile.currentFocus.focusAreas },
  { k: "stack", v: profile.currentFocus.techStack },
  { k: "oss", v: profile.currentFocus.contributions },
];

export default function About() {
  return (
    <SectionWrapper id="about" subtitle="Background" title="About">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          {profile.about.map((paragraph, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="text-[15px] leading-7 text-zinc-400"
            >
              {paragraph}
            </motion.p>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="h-fit overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        >
          <div className="border-b border-white/10 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Now
          </div>
          <dl className="space-y-4 p-5">
            {yamlLines.map((line, i) => (
              <motion.div
                key={line.k}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.08 }}
              >
                <dt className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                  {line.k}
                </dt>
                <dd className="mt-1 text-sm text-zinc-200">{line.v}</dd>
              </motion.div>
            ))}
          </dl>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
