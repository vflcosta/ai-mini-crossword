// frontend/src/api.ts
import type { BackendPayload, BackendPayloadWithMeta, LimitDetail } from "./types/api";
import { backendToCrossword } from "./utils/transform";
import type { Crossword } from "./types/crossword";
import { API_BASE, GRID_SIZE } from "./config";

/** Thrown when the player (or everyone together) has used today's new puzzles. */
export class LimitReachedError extends Error {
  readonly code: LimitDetail["code"];
  readonly limit: number;
  readonly resetsAt: Date;

  constructor(detail: LimitDetail) {
    super(detail.message);
    this.name = "LimitReachedError";
    this.code = detail.code;
    this.limit = detail.limit;
    this.resetsAt = new Date(detail.resets_at);
  }
}

/**
 * Original-style call used in your zip:
 * POST /generate-crossword with optional theme and size
 * returns the raw backend payload
 */
export async function generateCrossword(
  theme?: string | null,
  size: number = GRID_SIZE
): Promise<BackendPayloadWithMeta> {
  const res = await fetch(`${API_BASE}/generate-crossword`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      theme: theme && theme.trim() !== "" ? theme : null,
      size,
    }),
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => null);
    if (body?.detail?.code) throw new LimitReachedError(body.detail as LimitDetail);
  }
  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  const data: BackendPayloadWithMeta = await res.json();
  return data;
}

/**
 * Today's angle for each featured theme, e.g. { History: "Ancient Egypt" },
 * from GET /featured. Empty when the backend cannot be reached: the theme
 * buttons then simply show their names.
 */
export async function fetchFeaturedAngles(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${API_BASE}/featured`);
    if (!res.ok) return {};
    const body: { themes?: Array<{ theme: string; angle: string }> } = await res.json();
    return Object.fromEntries((body.themes ?? []).map((t) => [t.theme, t.angle]));
  } catch {
    return {};
  }
}

/**
 * Convenience function we added earlier for the newer version:
 * fetches the backend and immediately turns it into a Crossword
 */
export async function fetchCrossword(theme?: string): Promise<Crossword> {
  const payload = await generateCrossword(theme ?? null, GRID_SIZE);
  return backendToCrossword(payload, theme || "Random");
}

// re-export the type so other files can import from "./api"
export type { BackendPayload };