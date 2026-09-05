"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The inline script in layout.tsx already applies the right theme class to
  // <html> before hydration; read it back so this never flashes the wrong theme.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        setThemeState(next);
        window.localStorage.setItem("theme", next);
        applyTheme(next);
      },
      toggle: () => {
        setThemeState((current) => {
          const next = current === "dark" ? "light" : "dark";
          window.localStorage.setItem("theme", next);
          applyTheme(next);
          return next;
        });
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
