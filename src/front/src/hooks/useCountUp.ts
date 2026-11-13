import { useEffect, useState } from "react";

/**
 * A number that counts from 0 up to `target` once `active` turns true. For a visitor who asks
 * for reduced motion it is `target` from the start.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1600): number {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active || reduced) {
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // Ease out: the count slows down as it arrives.
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, active, reduced, durationMs]);

  return reduced ? target : value;
}
