// Settings that differ between your computer and the live website.

/**
 * Address of the backend. On your computer it is the local server; for the
 * live site set VITE_API_URL when building (render.yaml does this for you).
 */
export const API_BASE: string = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

/** Puzzle size: 7x7, for today's puzzle and themes alike. */
export const GRID_SIZE = 7;

/**
 * Theme buttons on the home screen. These are shared by everyone and never
 * count against a player's daily limit; the backend lists the same themes in
 * backend/utils/puzzle_service.py (a backend test checks they match).
 */
export const FEATURED_THEMES = ["History", "Space", "Art", "Nature", "Science"];

/** A small picture for each featured theme button (decoration only). */
export const THEME_ICONS: Record<string, string> = {
  History: "🏛️",
  Space: "🚀",
  Art: "🎨",
  Nature: "🌿",
  Science: "🔬",
};

/** A new puzzle day starts at midnight here (keep in sync with PUZZLE_TIMEZONE on the backend). */
export const PUZZLE_TIMEZONE = "Europe/Zurich";

/**
 * Privacy policy page. Set PRIVACY_CONTACT to the email address players can
 * write to (required before launch), and bump the date when the policy changes.
 */
export const PRIVACY_CONTACT = "aiminicrosswordpuzzle@gmail.com";
export const PRIVACY_LAST_UPDATED = "15 November 2026";

/**
 * Usage statistics (PostHog). The project key is meant to be public: it can
 * only send events, not read them. Set VITE_POSTHOG_KEY to an empty value at
 * build time to switch statistics off. See src/analytics.ts for what is sent.
 */
export const POSTHOG_KEY: string =
  import.meta.env.VITE_POSTHOG_KEY ?? "phc_xBvrnbW74AtcaDWziRCw3gvKnS9TjaetE5womBUQKRJq";
/** EU data region. Use https://us.i.posthog.com if the project is in the US region. */
export const POSTHOG_HOST: string = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";
