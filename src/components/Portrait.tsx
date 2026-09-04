"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { profile } from "@/data/profile";

export default function Portrait() {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[320px] lg:mx-0 lg:max-w-[360px]"
    >
      <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-stone-400/25 via-transparent to-cyan-900/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#12151c] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="relative aspect-[3/4] overflow-hidden">
          <Image
            src={profile.avatar}
            alt={`${profile.name}, senior software engineer`}
            fill
            priority
            sizes="360px"
            className="object-cover ken-burns"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-transparent to-transparent opacity-70" />
          <div className="portrait-sweep" />
        </div>
        <figcaption className="flex items-end justify-between gap-3 border-t border-white/10 px-5 py-4">
          <div>
            <p className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-wide text-white">
              {profile.name}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{profile.title}</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
        </figcaption>
      </div>
    </motion.figure>
  );
}
