import type { Clue, Crossword } from "../types/crossword";

/**
 * The rules of moving around the grid while solving, kept apart from the
 * screen so they are easy to test. Positions are { row, col }; answers are a
 * grid of letters ("" = empty square).
 */
export type Pos = { row: number; col: number };
export type Dir = "across" | "down";
export type Answers = string[][];

export const key = (p: Pos) => `${p.row},${p.col}`;
export const clueKey = (c: Clue) => `${c.number}-${c.direction}`;

/** The squares of a clue's answer, in order. */
export function cellsOf(clue: Clue): Pos[] {
  return Array.from({ length: clue.answer.length }, (_, i) =>
    clue.direction === "across"
      ? { row: clue.row, col: clue.col + i }
      : { row: clue.row + i, col: clue.col }
  );
}

/** All clues in the order the arrows walk through them: 1 across, 2 down, ... */
export function clueOrder(cw: Crossword): Clue[] {
  return [...cw.clues.across, ...cw.clues.down].sort((a, b) =>
    a.number !== b.number ? a.number - b.number : a.direction === "across" ? -1 : 1
  );
}

/** The clue running through a square in the given direction, if any. */
export function clueAt(cw: Crossword, p: Pos, dir: Dir): Clue | null {
  const list = dir === "across" ? cw.clues.across : cw.clues.down;
  return list.find((c) => cellsOf(c).some((q) => q.row === p.row && q.col === p.col)) ?? null;
}

/** The first empty square of a clue, or its first square when it is full. */
export function firstEmpty(clue: Clue, answers: Answers): Pos {
  const cells = cellsOf(clue);
  return cells.find((p) => !answers[p.row]?.[p.col]) ?? cells[0];
}

const isFull = (clue: Clue, answers: Answers) =>
  cellsOf(clue).every((p) => answers[p.row]?.[p.col]);

/**
 * Where the cursor goes after a letter: the next square of the same word,
 * even if it already has a letter (so a word can be typed again over a wrong
 * one). Only after the word's last square does it move on, to the first empty
 * square of the next unfinished clue. Stays put when the whole grid is full.
 */
export function afterTyping(
  cw: Crossword,
  answers: Answers,
  at: Pos,
  clue: Clue
): { pos: Pos; dir: Dir } {
  const cells = cellsOf(clue);
  const i = cells.findIndex((p) => p.row === at.row && p.col === at.col);
  if (i >= 0 && i < cells.length - 1) return { pos: cells[i + 1], dir: clue.direction };

  const order = clueOrder(cw);
  const j = order.findIndex((c) => clueKey(c) === clueKey(clue));
  for (let k = 1; k <= order.length; k++) {
    const other = order[(j + k) % order.length];
    if (!isFull(other, answers)) return { pos: firstEmpty(other, answers), dir: other.direction };
  }
  return { pos: at, dir: clue.direction };
}

/** The square one step back in the word (or the same square at its start). */
export function stepBack(at: Pos, clue: Clue): Pos {
  const cells = cellsOf(clue);
  const i = cells.findIndex((p) => p.row === at.row && p.col === at.col);
  return i > 0 ? cells[i - 1] : at;
}

/** True when every white square holds the right letter. */
export function isSolved(cw: Crossword, answers: Answers): boolean {
  return cw.grid.every((row, r) =>
    row.every((cell, c) => cell.isBlack || answers[r][c] === cell.letter)
  );
}

/** "1:21" */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Clue text size: longer clues step down so up to 3 lines fit the bar. */
export function clueFontSize(text: string): number {
  return text.length > 70 ? 15 : text.length > 45 ? 16 : 17;
}
