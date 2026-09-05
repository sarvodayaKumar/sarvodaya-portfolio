"use client";

import { motion } from "framer-motion";
import { Activity, Cloud, Code, Shield } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";

const iconMap = {
  activity: Activity,
  cloud: Cloud,
  code: Code,
  shield: Shield,
};

export default function Expertise() {
  return (
    <SectionWrapper id="expertise" subtitle="Practice" title="Where I go deep">
      <div className="grid gap-6 sm:grid-cols-2">
        {profile.expertise.map((item, i) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <GlowCard className="h-full p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon size={24} />
                </div>
                <h3 className="mb-3 font-[family-name:var(--font-syne)] text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <ul className="space-y-2">
                  {item.items.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--glow)]" />
                      {point}
                    </li>
                  ))}
                </ul>
              </GlowCard>
            </motion.div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
