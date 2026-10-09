"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Anima un número desde 0 hasta `target`. Respeta `prefers-reduced-motion`
 * y vuelve a animar cada vez que cambia el objetivo (p. ej. el rango de fechas).
 */
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(0);
      return;
    }

    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        frame.current = null;
        setValue(target);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [target, duration]);

  return value;
}
