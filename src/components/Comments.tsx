"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

const REPO = "sarvodayaKumar/sarvodaya-portfolio";
const REPO_ID = "R_kgDOUOnTxA";
const CATEGORY = "General";
const CATEGORY_ID = "DIC_kwDOUOnTxM4DE8ac";

export default function Comments() {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", REPO);
    script.setAttribute("data-repo-id", REPO_ID);
    script.setAttribute("data-category", CATEGORY);
    script.setAttribute("data-category-id", CATEGORY_ID);
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "bottom");
    script.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
    script.setAttribute("data-lang", "en");
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
    // Mount once; theme changes are pushed to the live iframe below instead
    // of remounting the whole widget (giscus's documented pattern).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
    iframe?.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: theme === "dark" ? "dark" : "light" } } },
      "https://giscus.app"
    );
  }, [theme]);

  return (
    <div className="mt-16 border-t border-border pt-10">
      <h2 className="mb-6 font-[family-name:var(--font-syne)] text-xl font-semibold text-foreground">
        Comments
      </h2>
      <div ref={ref} />
    </div>
  );
}
