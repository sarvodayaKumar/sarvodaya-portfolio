"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import BootScreen from "./BootScreen";
import { IntroContext } from "./IntroContext";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function getReducedMotionSnapshot() { return window.matchMedia(REDUCED_MOTION_QUERY).matches; }
function getServerReducedMotionSnapshot() { return false; }

export default function PageLoader({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(10);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getServerReducedMotionSnapshot);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    let current = 10;
    document.body.style.overflow = "hidden";

    const tick = window.setInterval(() => {
      current = Math.min(current + (current > 72 ? 0.7 : 2.2), 94);
      if (!cancelled) setProgress(Math.round(current));
    }, 40);

    const finish = () => {
      if (cancelled) return;
      window.clearInterval(tick);
      setProgress(100);
      window.setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        setReady(true);
        document.body.style.overflow = "";
      }, 380);
    };

    if (reducedMotion) {
      window.clearInterval(tick);
      setVisible(false);
      setReady(true);
      document.body.style.overflow = "";
      return;
    }

    const hold = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1400);
    });
    const fonts =
      "fonts" in document ? document.fonts.ready.then(() => undefined) : Promise.resolve();
    const cap = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 2400);
    });

    Promise.race([Promise.all([hold, fonts]).then(() => undefined), cap]).then(finish);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      document.body.style.overflow = "";
    };
  }, [reducedMotion, ready]);

  const intro = useMemo(() => ({ ready: ready || reducedMotion }), [ready, reducedMotion]);

  return (
    <IntroContext.Provider value={intro}>
      <AnimatePresence>
        {visible && !reducedMotion && (
          <motion.div
            className="boot-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <BootScreen progress={reducedMotion ? 100 : progress} />
          </motion.div>
        )}
      </AnimatePresence>
      <div aria-hidden={visible && !reducedMotion}>{children}</div>
    </IntroContext.Provider>
  );
}
