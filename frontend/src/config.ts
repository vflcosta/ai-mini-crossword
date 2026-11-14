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

/**
 * Theme buttons on the home screen. These are shared by everyone and never
 * count against a player's daily limit; the backend lists the same themes in
 * backend/utils/puzzle_service.py (a backend test checks they match).
 */
export const FEATURED_THEMES = ["Coffee", "Space", "Art", "Nature", "Science"];
