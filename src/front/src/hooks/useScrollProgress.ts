import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type RefObject, useEffect, useState } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * How far the page has scrolled through an element: 0 when its top reaches the top of the
 * window, 1 when its bottom reaches the bottom. The value follows the scroll with a short
 * delay, so a scene driven by it moves smoothly. It stays at 0 when the visitor asks for
 * reduced motion.
 */
export function useScrollProgress(target: RefObject<HTMLElement | null>, smoothing = 0.6): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = target.current;
    if (!element || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const state = { value: 0 };
    const context = gsap.context(() => {
      gsap.to(state, {
        value: 1,
        ease: "none",
        onUpdate: () => setProgress(state.value),
        scrollTrigger: { trigger: element, start: "top top", end: "bottom bottom", scrub: smoothing },
      });
    });
    return () => context.revert();
  }, [target, smoothing]);

  return progress;
}
