"use client";

import { motion } from "framer-motion";
import { Mail, Phone, Send } from "lucide-react";
import { profile } from "@/data/profile";
import { GithubIcon, LinkedInIcon } from "./BrandIcons";
import GlowCard from "./GlowCard";
import ResumeLink from "./ResumeLink";
import SectionWrapper from "./SectionWrapper";

const contactLinks = [
  {
    icon: LinkedInIcon,
    label: "LinkedIn",
    href: profile.links.linkedin,
  },
  {
    icon: Mail,
    label: "Email",
    href: `mailto:${profile.links.email}`,
  },
  {
    icon: GithubIcon,
    label: "GitHub",
    href: profile.links.github,
  },
  ...(profile.links.phone
    ? [
        {
          icon: Phone,
          label: "Phone",
          href: profile.links.phone,
        },
      ]
    : []),
];

export default function Contact() {
  return (
    <SectionWrapper id="contact" subtitle="Contact" title="Get in touch">
      <div className="relative mx-auto max-w-2xl text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-cyan-500/10 blur-3xl" />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-zinc-400"
        >
          Based in Bangalore. Open to conversations about Go systems, Terraform
          providers, and cloud-native platforms.
        </motion.p>

        <div className="grid gap-4 sm:grid-cols-2">
          {contactLinks.map((link, i) => (
            <motion.div
              key={link.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <a
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                <GlowCard className="px-5 py-4 text-left">
                  <span className="flex items-center gap-3">
                    <link.icon size={20} />
                    <span>
                      <span className="block text-sm font-medium text-zinc-200">{link.label}</span>
                      <span className="font-mono text-xs text-zinc-500">
                        {link.href
                          .replace("https://", "")
                          .replace("mailto:", "")
                          .replace("tel:", "")}
                      </span>
                    </span>
                  </span>
                </GlowCard>
              </a>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ResumeLink className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-medium text-zinc-950" />
          <motion.a
            href={`mailto:${profile.links.email}`}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-3.5 text-sm font-medium text-zinc-200"
          >
            <Send size={16} />
            Email me
          </motion.a>
        </div>
      </div>
    </SectionWrapper>
  );
}
