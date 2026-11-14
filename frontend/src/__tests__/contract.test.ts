/**
 * Keeps frontend and backend in sync.
 *
 * sample_payload.json is an example of exactly what the backend sends. The
 * backend has its own test proving it still produces this file. Here we prove
 * the frontend turns it into a correct, playable puzzle.
 */
import { expect, it } from 'vitest';
import sample from '../../../backend/tests/fixtures/sample_payload.json';
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
