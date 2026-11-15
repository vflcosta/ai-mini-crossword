/**
 * Usage statistics (PostHog), kept in this one file so the tool can be
 * swapped without touching the rest of the app.
 *
 * Privacy rules this file enforces (the privacy policy relies on them):
 *   - cookieless: nothing is stored in the visitor's browser
 *   - no automatic capture of clicks, no heatmaps, no session recordings
 *   - only the events listed in `AnalyticsEvent` are sent
 *   - the theme text a player types is NEVER sent, only the kind of puzzle
 *
 * Statistics are only collected on the live site (a production build), so
 * local development and the automated tests never send anything.
 *
 * The PostHog library is large, so it is downloaded in the background after
 * the game has appeared; events that happen before it is ready wait in a queue.
 */
import { FEATURED_THEMES, POSTHOG_HOST, POSTHOG_KEY } from "./config";

export type PuzzleType = "daily" | "featured" | "custom";

export type AnalyticsEvent =
  | {
      name: "puzzle_started";
      puzzle_type: PuzzleType;
      /** set for featured themes only (a fixed list, never typed text) */
      featured_theme?: string;
      /** true if the puzzle already existed today, false if it was newly made */
      cached?: boolean;
    }
  | { name: "puzzle_completed"; puzzle_type: PuzzleType; seconds: number; reveals: number }
  | { name: "limit_reached"; code: "player_limit" | "daily_capacity" };

type Client = { capture: (name: string, properties: Record<string, unknown>) => void };

let enabled = false;
let client: Client | null = null;
let waiting: AnalyticsEvent[] = [];

export async function initAnalytics(
  options: { enabled?: boolean; key?: string; host?: string } = {}
): Promise<boolean> {
  const on = options.enabled ?? import.meta.env.PROD;
  const key = options.key ?? POSTHOG_KEY;
  client = null;
  waiting = [];
  enabled = Boolean(on && key);
  if (!enabled) return false;

  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      api_host: options.host ?? POSTHOG_HOST,
      cookieless_mode: "always", // no cookies, no browser storage
      autocapture: false, // only the events below, not every click
      capture_pageview: true, // counts visitors
      capture_pageleave: false,
      capture_heatmaps: false,
      disable_session_recording: true,
      disable_surveys: true,
      capture_performance: { web_vitals: true }, // page speed only
    });
    client = posthog;
    const queued = waiting;
    waiting = [];
    queued.forEach(send);
    return true;
  } catch {
    // e.g. blocked by an ad blocker: the game simply runs without statistics
    enabled = false;
    waiting = [];
    return false;
  }
}

function send(event: AnalyticsEvent): void {
  const { name, ...properties } = event;
  try {
    client?.capture(name, properties);
  } catch {
    // statistics must never break the game
  }
}

export function track(event: AnalyticsEvent): void {
  if (!enabled) return;
  if (client) send(event);
  else if (waiting.length < 50) waiting.push(event);
}

/** What kind of puzzle a theme is, without revealing typed text. */
export function describePuzzle(theme: string): { puzzle_type: PuzzleType; featured_theme?: string } {
  const wanted = theme.trim().toLowerCase();
  if (!wanted) return { puzzle_type: "daily" };
  const featured = FEATURED_THEMES.find((t) => t.toLowerCase() === wanted);
  return featured ? { puzzle_type: "featured", featured_theme: featured } : { puzzle_type: "custom" };
}
