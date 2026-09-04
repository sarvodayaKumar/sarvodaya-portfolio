"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { profile } from "@/data/profile";
import { site } from "@/data/site";

export default function Portrait() {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 180, damping: 18 });

  return (
    <motion.figure
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      onMouseMove={(event) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        mx.set((event.clientX - rect.left) / rect.width - 0.5);
        my.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative mx-auto w-full max-w-[320px] [perspective:1200px] lg:mx-0 lg:max-w-[340px]"
    >
      <div className="absolute -inset-5 rounded-[32px] bg-accent/15 blur-2xl" />
      <div className="relative overflow-hidden rounded-[24px] border border-border bg-card shadow-xl">
        <div className="relative aspect-[3/4] overflow-hidden">
          <Image
            src={profile.avatar}
            alt={`${profile.name}, ${site.role}`}
            fill
            priority
            sizes="340px"
            className="object-cover ken-burns"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-70" />
          <div className="portrait-sweep" />
        </div>
        <figcaption className="flex items-end justify-between gap-3 border-t border-border px-5 py-4">
          <div>
            <p className="font-[family-name:var(--font-syne)] text-sm font-semibold text-foreground">
              {profile.name}
            </p>
            <p className="mt-0.5 text-xs text-muted">{site.role}</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </figcaption>
      </div>
    </motion.figure>
  );
}
