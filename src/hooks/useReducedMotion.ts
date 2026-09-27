import { useState, useEffect } from "react";

/**
 * Lightweight, zero-dependency hook for detecting prefers-reduced-motion.
 * Completely eliminates importing the entire framer-motion runtime on universal routes.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setReduceMotion(event.matches);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return reduceMotion;
}
