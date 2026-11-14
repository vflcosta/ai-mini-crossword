/**
 * Keeps frontend and backend in sync.
 *
 * sample_payload.json is an example of exactly what the backend sends. The
 * backend has its own test proving it still produces this file. Here we prove
 * the frontend turns it into a correct, playable puzzle.
 */
import { expect, it } from 'vitest';
import sample from '../../../backend/tests/fixtures/sample_payload.json';
import dense from '../../../backend/tests/fixtures/dense_payload.json';
import { backendToCrossword } from '../utils/transform';
import type { BackendPayload } from '../types/api';

it('the frontend shows exactly the answers and clues the backend sent', () => {
  const payload = sample.payload as BackendPayload;
  const cw = backendToCrossword(payload, 'Nature');

  for (const direction of ['across', 'down'] as const) {
    expect(cw.clues[direction].map((c) => [c.answer, c.clue])).toEqual(
      payload.clues[direction].map((c) => [c.answer, c.clue])
    );
  }
  const sent = new Map(sample.words.map((w) => [w.answer, w.clue]));
  for (const clue of [...cw.clues.across, ...cw.clues.down]) {
    expect(sent.get(clue.answer)).toBe(clue.clue);
  }
});

it('a dense newspaper-style puzzle from the backend is shown clue for clue', () => {
  const payload = dense.payload as BackendPayload;
  const cw = backendToCrossword(payload, 'ocean');

  // same answers, clues and numbers, in the same order
  for (const direction of ['across', 'down'] as const) {
    expect(cw.clues[direction].map((c) => [c.number, c.answer, c.clue])).toEqual(
      payload.clues[direction].map((c) => [c.number, c.answer, c.clue])
    );
  }
  // every white square belongs to an across word and a down word
  const covered = { across: new Set<string>(), down: new Set<string>() };
  for (const clue of [...cw.clues.across, ...cw.clues.down]) {
    for (let i = 0; i < clue.answer.length; i++) {
      const row = clue.direction === 'down' ? clue.row + i : clue.row;
      const col = clue.direction === 'across' ? clue.col + i : clue.col;
      expect(cw.grid[row][col].letter).toBe(clue.answer[i]);
      covered[clue.direction].add(`${row},${col}`);
    }
  }
  const white = cw.grid.flat().filter((c) => !c.isBlack).length;
  expect(covered.across.size).toBe(white);
  expect(covered.down.size).toBe(white);
});
