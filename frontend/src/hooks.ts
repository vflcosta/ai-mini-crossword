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
