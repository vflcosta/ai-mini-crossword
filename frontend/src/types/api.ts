// frontend/src/types/api.ts

// shape the backend actually returns
export interface BackendPayload {
  grid: string[][];
  clues: {
    across: Array<{
      number?: number | null;
      clue: string;
      answer: string;
    }>;
    down: Array<{
      number?: number | null;
      clue: string;
      answer: string;
    }>;
  };
}
// extra information the backend sends with every puzzle
export interface PuzzleMeta {
  /** true if someone already made this puzzle today (it was free) */
  cached: boolean;
  /** true for today's puzzle and the featured themes, which never count */
  free: boolean;
  /** how many new themed puzzles this player can still make today */
  new_puzzles_left: number;
  /** when the day (and the limits) start over, ISO date-time */
  resets_at: string;
  /** today's angle of a featured theme, e.g. "Ancient Egypt" for History */
  angle?: string;
}

export interface BackendPayloadWithMeta extends BackendPayload {
  meta?: PuzzleMeta;
}

// body of a 429 answer
export interface LimitDetail {
  code: "player_limit" | "daily_capacity";
  message: string;
  limit: number;
  resets_at: string;
  retry_after_seconds: number;
}
