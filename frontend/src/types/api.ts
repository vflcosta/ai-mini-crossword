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