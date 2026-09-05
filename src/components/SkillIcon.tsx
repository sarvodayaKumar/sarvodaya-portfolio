"use client";

import { skillIconUrl } from "@/lib/skillIcons";

export default function SkillIcon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const src = skillIconUrl(name);
  if (!src) {
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
    // Simple Icons CDN brand marks; next/image is unnecessary for tiny SVGs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      loading="lazy"
    />
  );
}
