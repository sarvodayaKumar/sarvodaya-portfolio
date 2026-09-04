"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useTheme } from "./ThemeProvider";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });

export default function AmbientBackground() {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 35, damping: 22 });
  const sy = useSpring(y, { stiffness: 35, damping: 22 });
  const light = theme === "light";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setEnabled(!media.matches);
    const onMove = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [x, y]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute -left-[20%] -top-[20%] h-[70%] w-[70%] rounded-full blur-[90px]"
        style={{
          opacity: light ? 0.55 : 0.8,
          background: light
            ? "radial-gradient(circle, rgba(15,118,110,0.18) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 70%)",
          animation: enabled ? "aurora 16s ease-in-out infinite" : undefined,
        }}
      />
      <div
        className="absolute -right-[15%] top-[5%] h-[62%] w-[58%] rounded-full blur-[100px]"
        style={{
          opacity: light ? 0.4 : 0.7,
          background: light
            ? "radial-gradient(circle, rgba(68,64,60,0.12) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)",
          animation: enabled ? "aurora-alt 20s ease-in-out infinite" : undefined,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[50%] bg-horizon-grid opacity-40" />
      {enabled && (
        <div className="absolute inset-0 opacity-80">
          <Scene3D />
        </div>
      )}
      {enabled && (
        <motion.div
          className="absolute h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: sx,
            top: sy,
            background: light
              ? "radial-gradient(circle, rgba(15,118,110,0.12) 0%, transparent 68%)"
              : "radial-gradient(circle, rgba(125,211,252,0.12) 0%, transparent 68%)",
          }}
        />
      )}
      <div className="bg-vignette absolute inset-0" />
      <div className="noise-overlay" />
    </div>
  );
}
