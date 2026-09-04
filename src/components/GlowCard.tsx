"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";

export default function GlowCard({
  children,
  className = "",
  href,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 50, y: 50 });
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hover, setHover] = useState(false);

  const onMove = (event: MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCoords({ x, y });
    setTilt({
      ry: ((event.clientX - rect.left) / rect.width - 0.5) * 8,
      rx: (0.5 - (event.clientY - rect.top) / rect.height) * 7,
    });
  };

  const style = {
    transform: hover
      ? `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(-4px)`
      : "perspective(1100px) rotateX(0deg) rotateY(0deg)",
    background: hover
      ? `radial-gradient(420px circle at ${coords.x}% ${coords.y}%, var(--glow), transparent 42%), var(--card)`
      : "var(--card)",
  };

  const inner = (
    <>
      <span
        className="pointer-events-none absolute inset-px rounded-2xl opacity-0 transition-opacity duration-300"
        style={{
          opacity: hover ? 1 : 0,
          background: `radial-gradient(500px circle at ${coords.x}% ${coords.y}%, var(--glow), transparent 40%)`,
        }}
      />
      <span className="relative z-10 block h-full">{children}</span>
    </>
  );

  const sharedClass = `relative block overflow-hidden rounded-2xl border border-border shadow-sm backdrop-blur-md transition-[transform,box-shadow] duration-200 ease-out ${className}`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={sharedClass}
        style={style}
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          setTilt({ rx: 0, ry: 0 });
        }}
      >
        <div ref={ref} className="h-full">
          {inner}
        </div>
      </a>
    );
  }

  return (
    <div
      ref={ref}
      className={sharedClass}
      style={style}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setTilt({ rx: 0, ry: 0 });
      }}
    >
      {inner}
    </div>
  );
}
