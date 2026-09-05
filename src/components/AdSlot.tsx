"use client";

import { useEffect, useRef } from "react";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT_ID is set (after AdSense
// approval) and `slot` is filled in with a real ad unit ID from the AdSense
// dashboard. Safe to leave in place before either exists.
export default function AdSlot({ slot }: { slot?: string }) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle script not loaded yet or blocked by an ad blocker — no-op.
    }
  }, [slot]);

  if (!ADSENSE_CLIENT_ID || !slot) return null;

  return (
    <ins
      ref={ref}
      className="adsbygoogle block"
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
