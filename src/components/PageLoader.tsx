"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function PageLoader({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.style.overflow = "hidden";

    if (reduce) {
      setProgress(100);
      document.body.style.overflow = "";
      setVisible(false);
      return;
    }

    let current = 8;
    const tick = window.setInterval(() => {
      current = Math.min(current + (current > 78 ? 0.45 : 1.8), 90);
      setProgress(Math.round(current));
    }, 32);

    const minimum = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1500);
    });
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }
      window.addEventListener("load", () => resolve(), { once: true });
    });

    Promise.all([minimum, loaded]).then(() => {
      window.clearInterval(tick);
      setProgress(100);
      window.setTimeout(() => {
        document.body.style.overflow = "";
        setVisible(false);
      }, 480);
    });

    return () => {
      window.clearInterval(tick);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
            aria-live="polite"
            aria-busy="true"
            role="status"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card font-[family-name:var(--font-syne)] text-xl font-semibold text-foreground"
            >
              SK
            </motion.div>
            <p className="font-[family-name:var(--font-syne)] text-2xl text-foreground sm:text-3xl">
              Sarvodaya Kumar
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
              Cloud backend developer
            </p>
            <div className="mt-10 w-56">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                <span>Loading</span>
                <span>{progress}%</span>
              </div>
              <div className="h-[2px] overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full bg-accent"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
