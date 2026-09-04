"use client";

import { motion } from "framer-motion";

export default function SectionWrapper({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="mb-14"
        >
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.32em] text-stone-500">
            {subtitle}
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-3xl font-semibold text-white sm:text-4xl">
            {title}
          </h2>
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: 48 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-4 h-px bg-stone-500"
          />
        </motion.div>
        {children}
      </div>
    </section>
  );
}
