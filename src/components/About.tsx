"use client";

import { motion } from "framer-motion";
import { site } from "@/data/site";
import SectionWrapper from "./SectionWrapper";

export default function About() {
  return (
    <SectionWrapper id="about" subtitle="Background" title="About">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          {site.about.map((paragraph, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="text-[16px] leading-8 text-muted"
            >
              {paragraph}
            </motion.p>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="h-fit overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Now
          </div>
          <dl className="space-y-4 p-5">
            {site.now.map((line) => (
              <div key={line.k}>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-accent">{line.k}</dt>
                <dd className="mt-1 text-sm leading-6 text-foreground">{line.v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {site.principles.map((item) => (
          <article key={item.title} className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-[family-name:var(--font-syne)] text-lg text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
          </article>
        ))}
      </div>
    </SectionWrapper>
  );
}
