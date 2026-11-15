import { useEffect, useState } from "react";

function currentHost(): HTMLElement {
  return (document.fullscreenElement as HTMLElement | null) ?? document.body;
}

/**
 * The element a floating control must be drawn in to stay visible: the page, or the element that
 * is in full screen, which hides everything outside itself.
 */
export function useFullscreenHost(): HTMLElement {
  const [host, setHost] = useState<HTMLElement>(currentHost);

  useEffect(() => {
    const follow = () => setHost(currentHost());
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);

  return host;
}
