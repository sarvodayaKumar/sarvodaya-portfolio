"use client";

import { motion } from "framer-motion";
import { Award, GraduationCap } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";

export default function Certifications() {
  return (
    <SectionWrapper id="certifications" subtitle="Credentials" title="Education">
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <GlowCard className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <Award className="text-cyan-300" size={22} />
              <h3 className="font-[family-name:var(--font-syne)] font-semibold text-white">
                Certifications
              </h3>
            </div>
            <div className="space-y-4">
              {profile.certifications.map((cert) => (
                <div
                  key={cert.name}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-200">{cert.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs ${
                        cert.status === "completed"
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {cert.status === "completed" ? "Earned" : "In Progress"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{cert.detail}</p>
                </div>
              ))}
            </div>
          </GlowCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <GlowCard className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <GraduationCap className="text-cyan-300" size={22} />
              <h3 className="font-[family-name:var(--font-syne)] font-semibold text-white">
                Education
              </h3>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="font-medium text-zinc-200">{profile.education.degree}</p>
              <p className="mt-2 text-sm text-zinc-400">{profile.education.school}</p>
              <p className="mt-1 font-mono text-xs text-zinc-500">{profile.education.period}</p>
            </div>
          </GlowCard>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
