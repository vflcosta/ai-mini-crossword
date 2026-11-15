import { useEffect, useState } from "react";

/** Wide screens (laptops, desktops) get a two-column layout and the clue lists. */
export const DESKTOP_QUERY = "(min-width: 900px)";

export function useIsDesktop(): boolean {
  const query = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(DESKTOP_QUERY)
      : null;
  const [isDesktop, setIsDesktop] = useState(() => query()?.matches ?? false);

  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

/**
 * How far the on-screen keyboard reaches up from the bottom of the page, in
 * pixels (0 when it is closed). Phones do not move "fixed" page elements out
 * of the keyboard's way, so the clue bar uses this to sit just above it.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!viewport) return;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
