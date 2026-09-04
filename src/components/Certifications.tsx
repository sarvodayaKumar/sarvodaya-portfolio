"use client";

import { Award, GraduationCap } from "lucide-react";
import { profile } from "@/data/profile";
import GlowCard from "./GlowCard";
import SectionWrapper from "./SectionWrapper";

export default function Certifications() {
  return (
    <SectionWrapper id="certifications" subtitle="Credentials" title="Education & certification">
      <div className="grid gap-6 md:grid-cols-2">
        <GlowCard className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <Award className="text-accent" size={22} />
            <h3 className="font-[family-name:var(--font-syne)] font-semibold text-foreground">
              Certifications
            </h3>
          </div>
          <div className="space-y-4">
            {profile.certifications.map((cert) => (
              <div key={cert.name} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{cert.name}</p>
                  <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    {cert.status === "completed" ? "Earned" : "In Progress"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">{cert.detail}</p>
              </div>
            ))}
          </div>
        </GlowCard>
        <GlowCard className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <GraduationCap className="text-accent" size={22} />
            <h3 className="font-[family-name:var(--font-syne)] font-semibold text-foreground">
              Education
            </h3>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-5">
            <p className="font-medium text-foreground">{profile.education.degree}</p>
            <p className="mt-2 text-sm text-muted">{profile.education.school}</p>
            <p className="mt-1 font-mono text-xs text-muted">{profile.education.period}</p>
          </div>
        </GlowCard>
      </div>
    </SectionWrapper>
  );
}
