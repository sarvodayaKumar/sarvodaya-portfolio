"use client";

import { motion } from "framer-motion";
import { site } from "@/data/site";
import SectionWrapper from "./SectionWrapper";
import SkillIcon from "./SkillIcon";

export default function Services() {
  return (
    <SectionWrapper id="expertise" subtitle="Practice" title="What I build">
      <p className="mb-10 max-w-3xl text-[16px] leading-7 text-muted">
        Cloud backend work with a bias toward systems that are explicit, tested, and operable:
        Go services, Azure infrastructure, and the Terraform that describes both.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {site.services.map((item, i) => (
          <motion.article
            key={item.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.45 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              0{i + 1}
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-syne)] text-xl font-semibold text-foreground">
              {item.title}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tools.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2 py-1 text-[11px] text-muted"
                >
                  <SkillIcon name={tool} size={12} />
                  {tool}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">{item.body}</p>
          </motion.article>
        ))}
      </div>
    </SectionWrapper>
  );
}
