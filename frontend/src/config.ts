// Settings that differ between your computer and the live website.

/**
 * Address of the backend. On your computer it is the local server; for the
 * live site set VITE_API_URL when building (render.yaml does this for you).
 */
export const API_BASE: string = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

/** Puzzle size: 5x5 is the classic newspaper mini. */
export const GRID_SIZE = 5;
