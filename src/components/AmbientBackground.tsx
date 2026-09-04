"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(true);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 35, damping: 22 });
  const sy = useSpring(y, { stiffness: 35, damping: 22 });

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

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let running = true;
    const particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      particles.length = 0;
      const count = window.innerWidth < 768 ? 42 : 78;
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.6 + 0.4,
        });
      }
    };

    const draw = () => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.fillStyle = "rgba(186, 230, 253, 0.7)";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const maxDist = w < 768 ? 90 : 130;
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.18;
            ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      frame = requestAnimationFrame(draw);
    };

    const onResize = () => {
      resize();
      seed();
    };

    resize();
    seed();
    draw();
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#070912]" />

      <div
        className="absolute -left-[20%] -top-[20%] h-[70%] w-[70%] rounded-full opacity-80 blur-[90px]"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.08) 42%, transparent 70%)",
          animation: enabled ? "aurora 16s ease-in-out infinite" : undefined,
        }}
      />
      <div
        className="absolute -right-[15%] top-[5%] h-[62%] w-[58%] rounded-full opacity-80 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.32) 0%, rgba(139,92,246,0.12) 40%, transparent 70%)",
          animation: enabled ? "aurora-alt 20s ease-in-out infinite" : undefined,
        }}
      />
      <div
        className="absolute bottom-[-18%] left-[18%] h-[55%] w-[55%] rounded-full opacity-70 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, rgba(244,114,182,0.18) 0%, rgba(251,191,36,0.08) 45%, transparent 70%)",
          animation: enabled ? "aurora 24s ease-in-out infinite" : undefined,
        }}
      />

      <div
        className="absolute left-1/2 top-[-10%] h-[70%] w-[80%] -translate-x-1/2 opacity-40 blur-[80px]"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 50%, rgba(34,211,238,0.2), rgba(99,102,241,0.16), rgba(244,114,182,0.12), rgba(34,211,238,0.2))",
          animation: enabled ? "mesh-shift 22s ease-in-out infinite" : undefined,
        }}
      />

      <div
        className="absolute left-[-10%] top-[12%] h-[140%] w-[38%] bg-gradient-to-b from-cyan-200/10 via-transparent to-transparent blur-2xl"
        style={{ animation: enabled ? "beam 12s ease-in-out infinite" : undefined }}
      />

      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-horizon-grid opacity-70" />

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {enabled && (
        <motion.div
          className="absolute h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: sx,
            top: sy,
            background:
              "radial-gradient(circle, rgba(125,211,252,0.16) 0%, rgba(167,139,250,0.08) 32%, transparent 68%)",
          }}
        />
      )}

      <div className="bg-vignette absolute inset-0" />
      <div className="noise-overlay" />
    </div>
  );
}
