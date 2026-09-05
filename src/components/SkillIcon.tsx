"use client";

import { useState } from "react";
import { skillIconUrl } from "@/lib/skillIcons";

export default function SkillIcon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const src = skillIconUrl(name);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent/10 font-mono text-[10px] font-semibold text-accent"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // Brand SVGs from Devicon / Simple Icons CDNs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
