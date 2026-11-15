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
 * Where the on-screen keyboard is, for pinning the clue bar just above it.
 *
 * - inset: how far the keyboard reaches up from the bottom of the page, in
 *   pixels (0 when it is closed, and always 0 in the iPhone app, where the page
 *   itself ends at the keyboard).
 * - moving: true while the page is being scrolled with the keyboard open.
 *
 * Phone browsers do not move "fixed" page elements out of the keyboard's way,
 * and while the player scrolls, Safari reports the new position only in
 * bursts, so a bar placed from those numbers floats around the screen. The bar
 * is therefore hidden while the page moves and comes back, in the right place,
 * once it settles.
 */
export function useKeyboardInset(): { inset: number; moving: boolean } {
  const [inset, setInset] = useState(0);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!viewport) return;
    let settle: number | undefined;
    const measure = () =>
      Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    const update = () => setInset(measure());
    const onMove = () => {
      // only Safari (keyboard drawn over the page) needs this
      if (measure() > 0) setMoving(true);
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        update();
        setMoving(false);
      }, 150);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", onMove);
    window.addEventListener("scroll", onMove);
    return () => {
      window.clearTimeout(settle);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", onMove);
      window.removeEventListener("scroll", onMove);
    };
  }, []);

  return { inset, moving };
}
