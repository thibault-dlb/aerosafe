import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * True once the element has come into view, and it stays true. A page uses it to fade its
 * sections in. Without `IntersectionObserver`, or for a visitor who asks for reduced motion,
 * the element counts as seen at once.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.2): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const immediate =
    typeof IntersectionObserver === "undefined" ||
    (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (immediate || !element) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [immediate, threshold]);

  return [ref, immediate || seen];
}
