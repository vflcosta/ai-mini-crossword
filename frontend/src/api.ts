// frontend/src/api.ts
import { BackendPayload } from "./types/api";
import { backendToCrossword } from "./utils/transform";
import type { Crossword } from "./types/crossword";

/**
 * Original-style call used in your zip:
 * POST /generate-crossword with optional theme and size
 * returns the raw backend payload
 */
export async function generateCrossword(
  theme?: string | null,
  size: number = 7
): Promise<BackendPayload> {
  const res = await fetch("http://127.0.0.1:8000/generate-crossword", {
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
  const payload = await generateCrossword(theme ?? null, 7);
  return backendToCrossword(payload, theme || "Random");
}

// re-export the type so other files can import from "./api"
export type { BackendPayload };