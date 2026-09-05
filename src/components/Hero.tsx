"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { useIntro } from "./IntroContext";

const HeroPortrait3D = dynamic(() => import("./HeroPortrait3D"), { ssr: false });

export default function Hero() {
  const { ready } = useIntro();

  return (
    <section className="relative z-10 flex min-h-[100svh] items-center px-6 pt-24 pb-12">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {ready ? (
            <HeroPortrait3D />
          ) : (
            <div className="relative mx-auto h-[440px] w-full max-w-[440px] lg:h-[580px] lg:max-w-none">
              <Image
                src={profile.avatar}
                alt=""
                fill
                priority
                sizes="440px"
                className="object-contain opacity-0"
              />
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="text-center lg:text-left"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
            {site.location}
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-syne)] text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-[4.6rem] lg:leading-[1.02]">
            {profile.name}
          </h1>
          <p className="mt-4 text-xl text-accent sm:text-2xl">{site.role}</p>
          <p className="mx-auto mt-5 max-w-md text-[16px] leading-7 text-muted lg:mx-0">
            {site.headline}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <a
              href="#about"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
            >
              About me
              <ArrowDown size={15} />
            </a>
            <a
              href="#experience"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm text-foreground hover:border-accent hover:text-accent"
            >
              Experience
            </a>
            {profile.links.instagram ? (
              <a
                href={profile.links.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm text-foreground hover:border-accent hover:text-accent"
              >
                Instagram
              </a>
            ) : null}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
