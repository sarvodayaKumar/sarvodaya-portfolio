"use client";

import { createContext, useContext } from "react";

export const IntroContext = createContext({ ready: true });

export function useIntro() {
  return useContext(IntroContext);
}
