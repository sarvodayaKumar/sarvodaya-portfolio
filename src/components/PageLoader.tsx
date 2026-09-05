"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import BootScreen from "./BootScreen";
import { IntroContext } from "./IntroContext";

export default function PageLoader({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(10);

  useEffect(() => {
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

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      window.clearInterval(tick);
      setProgress(100);
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
  }, []);

  const intro = useMemo(() => ({ ready }), [ready]);

  return (
    <IntroContext.Provider value={intro}>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="boot-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <BootScreen progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>
      <div aria-hidden={visible}>{children}</div>
    </IntroContext.Provider>
  );
}
