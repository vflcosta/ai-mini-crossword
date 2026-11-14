// frontend/src/api.ts
import { BackendPayload } from "./types/api";
import { backendToCrossword } from "./utils/transform";
import type { Crossword } from "./types/crossword";
import { API_BASE, GRID_SIZE } from "./config";

/**
 * Original-style call used in your zip:
 * POST /generate-crossword with optional theme and size
 * returns the raw backend payload
 */
export async function generateCrossword(
  theme?: string | null,
  size: number = GRID_SIZE
): Promise<BackendPayload> {
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

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  const data: BackendPayload = await res.json();
  return data;
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