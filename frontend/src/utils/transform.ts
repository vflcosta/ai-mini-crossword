// frontend/src/utils/transform.ts
import type { Crossword, Cell, Clue } from "../types/crossword";
import type { BackendPayload } from "../types/api";

/**
 * Build the crossword from the backend grid:
 * - "#" => black square
 * - anything that is NOT a single A–Z char => black square (prevents junk letters)
 * - number only real word starts (across/down) with length >= 3
 * - map backend clues IN ORDER to the detected starts (every start gets a clue)
 * - if backend gives placeholder clues ("Clue to fill", "(clue)", empty) show a safe fallback
 */
export function backendToCrossword(
  payload: BackendPayload,
  themeLabel: string
): Crossword {
  const size = payload.grid.length;

  // 1) Build grid cells (STRICT)
  const grid: Cell[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const raw = (payload.grid[r]?.[c] ?? "").toString().trim();

      // explicit black from backend
      if (raw === "#") {
        return { letter: "", isBlack: true } as Cell;
      }

      // only accept EXACTLY 1 A–Z char
      if (/^[A-Za-z]$/.test(raw)) {
        return { letter: raw.toUpperCase() } as Cell;
      }

      // everything else = black
      return { letter: "", isBlack: true } as Cell;
    })
  );

  const isBlack = (r: number, c: number) =>
    r < 0 || c < 0 || r >= size || c >= size || grid[r][c].isBlack === true;

  // 2) Number only true starts; collect across/down starts with lengths
  let nextNumber = 1;
  const numberMap: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(0)
  );

  type Start = { row: number; col: number; number: number; length: number };

  const acrossStarts: Start[] = [];
  const downStarts: Start[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isBlack(r, c)) continue;

      const startsAcross = c === 0 || isBlack(r, c - 1);
      const startsDown = r === 0 || isBlack(r - 1, c);

      // calculate lengths
      let acrossLen = 0;
      if (startsAcross) {
        let cc = c;
        while (cc < size && !isBlack(r, cc)) {
          acrossLen++;
          cc++;
        }
      }

      let downLen = 0;
      if (startsDown) {
        let rr = r;
        while (rr < size && !isBlack(rr, c)) {
          downLen++;
          rr++;
        }
      }

      // only number cells that start valid words (length >= 3)
      const hasValidAcross = startsAcross && acrossLen >= 3;
      const hasValidDown = startsDown && downLen >= 3;

      if (hasValidAcross || hasValidDown) {
        numberMap[r][c] = nextNumber;
        grid[r][c].number = nextNumber;

        if (hasValidAcross) {
          acrossStarts.push({
            row: r,
            col: c,
            number: nextNumber,
            length: acrossLen,
          });
        }

        if (hasValidDown) {
          downStarts.push({
            row: r,
            col: c,
            number: nextNumber,
            length: downLen,
          });
        }

        nextNumber++;
      }
    }
  }

  // helper to read the answer from the grid at a start
  const readWordFromGrid = (start: Start, dir: "across" | "down"): string => {
    const letters: string[] = [];
    for (let i = 0; i < start.length; i++) {
      const r = dir === "across" ? start.row : start.row + i;
      const c = dir === "across" ? start.col + i : start.col;
      letters.push(grid[r][c].letter || "");
    }
    return letters.join("").toUpperCase();
  };

  // helper to spot junk / placeholder clues coming from the backend
  const isJunkClue = (txt: string | undefined) => {
    if (!txt) return true;
    const lower = txt.trim().toLowerCase();
    if (!lower) return true;
    if (lower === "(clue)") return true;
    if (lower.includes("clue to fill")) return true;
    return false;
  };

  // 3) Map backend clues IN ORDER to detected starts.

  // across
  const across: Clue[] = [];
  for (let i = 0; i < acrossStarts.length; i++) {
    const st = acrossStarts[i];
    const src = payload.clues.across[i];

    // a word in the grid always gets a clue entry, even if the backend sent none
    const clueText = isJunkClue(src?.clue)
      ? "(no clue from generator)"
      : src!.clue;

    across.push({
      number: st.number,
      clue: clueText,
      answer: readWordFromGrid(st, "across"),
      row: st.row,
      col: st.col,
      direction: "across",
    });
  }

  // down
  const down: Clue[] = [];
  for (let i = 0; i < downStarts.length; i++) {
    const st = downStarts[i];
    const src = payload.clues.down[i];

    // a word in the grid always gets a clue entry, even if the backend sent none
    const clueText = isJunkClue(src?.clue)
      ? "(no clue from generator)"
      : src!.clue;

    down.push({
      number: st.number,
      clue: clueText,
      answer: readWordFromGrid(st, "down"),
      row: st.row,
      col: st.col,
      direction: "down",
    });
  }

  return {
    size,
    theme: themeLabel,
    grid,
    clues: { across, down },
  };
}