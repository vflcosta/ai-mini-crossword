/**
 * The rules for moving around the grid (src/utils/play.ts), on a 7x7 puzzle
 * like the one in the Claude Design file.
 */
import { describe, expect, it } from 'vitest';
import { backendToCrossword } from '../utils/transform';
import {
  afterTyping,
  clueAt,
  clueFontSize,
  clueOrder,
  firstEmpty,
  formatTime,
  isSolved,
  stepBack,
} from '../utils/play';
import { shareText } from '../components/Game';
import type { BackendPayload } from '../types/api';

// T R U M P E T    1 across TRUMPET, 1 down TUBA, 2 down TEMPO
// U # # # # # E    3 across BLUES, 4 down SCALE
// B L U E S # M    5 across PIANO
// A # # # C # P    6 across OPERA
// # # P I A N O
// # # # # L # #
// # # O P E R A
const PAYLOAD: BackendPayload = {
  grid: ['TRUMPET', 'U#####E', 'BLUES#M', 'A###C#P', '##PIANO', '####L##', '##OPERA'].map((r) =>
    r.split('')
  ),
  clues: {
    across: [
      { number: 1, clue: 'Brass instrument with three valves', answer: 'TRUMPET' },
      { number: 3, clue: 'Sad music from the Deep South', answer: 'BLUES' },
      { number: 5, clue: 'Instrument with 88 keys', answer: 'PIANO' },
      { number: 6, clue: 'Drama told entirely in song', answer: 'OPERA' },
    ],
    down: [
      { number: 1, clue: 'Largest brass instrument', answer: 'TUBA' },
      { number: 2, clue: 'Speed of a piece of music', answer: 'TEMPO' },
      { number: 4, clue: 'Do, re, mi and so on', answer: 'SCALE' },
    ],
  },
};
const cw = backendToCrossword(PAYLOAD, 'Music');
const empty = () => Array.from({ length: 7 }, () => Array(7).fill(''));
const find = (n: number, d: 'across' | 'down') =>
  clueOrder(cw).find((c) => c.number === n && c.direction === d)!;

describe('moving around a 7x7 grid', () => {
  it('walks through the clues in number order, across before down', () => {
    expect(clueOrder(cw).map((c) => `${c.number}${c.direction[0]}`)).toEqual([
      '1a', '1d', '2d', '3a', '4d', '5a', '6a',
    ]);
  });

  it('finds the clue running through a square in either direction', () => {
    expect(clueAt(cw, { row: 2, col: 4 }, 'across')?.answer).toBe('BLUES');
    expect(clueAt(cw, { row: 2, col: 4 }, 'down')?.answer).toBe('SCALE');
    expect(clueAt(cw, { row: 1, col: 0 }, 'across')).toBeNull();
  });

  it('after a letter, goes to the next empty square of the word, wrapping round', () => {
    const answers = empty();
    answers[0][0] = 'T';
    answers[0][2] = 'U';
    const to = afterTyping(cw, answers, { row: 0, col: 0 }, find(1, 'across'));
    expect(to.pos).toEqual({ row: 0, col: 1 });
    answers[0][1] = 'R';
    expect(afterTyping(cw, answers, { row: 0, col: 1 }, find(1, 'across')).pos).toEqual({
      row: 0,
      col: 3,
    }); // skips the U that is already there
  });

  it('after the last letter of a word, goes to the next unfinished clue', () => {
    const answers = empty();
    'TRUMPET'.split('').forEach((ch, c) => (answers[0][c] = ch));
    const to = afterTyping(cw, answers, { row: 0, col: 6 }, find(1, 'across'));
    expect(to).toEqual({ pos: { row: 1, col: 0 }, dir: 'down' }); // 1 down, first empty square
  });

  it('steps back one square in the word, and stays at its start', () => {
    expect(stepBack({ row: 2, col: 3 }, find(3, 'across'))).toEqual({ row: 2, col: 2 });
    expect(stepBack({ row: 2, col: 0 }, find(3, 'across'))).toEqual({ row: 2, col: 0 });
  });

  it('the first empty square of a clue, or its first square when it is full', () => {
    const answers = empty();
    answers[4][2] = 'P';
    expect(firstEmpty(find(5, 'across'), answers)).toEqual({ row: 4, col: 3 });
    'PIANO'.split('').forEach((ch, i) => (answers[4][2 + i] = ch));
    expect(firstEmpty(find(5, 'across'), answers)).toEqual({ row: 4, col: 2 });
  });

  it('is solved only when every white square holds the right letter', () => {
    const answers = PAYLOAD.grid.map((r) => r.map((ch) => (ch === '#' ? '' : ch)));
    expect(isSolved(cw, answers)).toBe(true);
    answers[6][6] = 'E';
    expect(isSolved(cw, answers)).toBe(false);
  });
});

describe('words on the game screen', () => {
  it('clue text steps down 17 → 16 → 15 px as clues get longer', () => {
    expect(clueFontSize('Feeling blue')).toBe(17);
    expect(clueFontSize('A long, determined campaign for a good cause, today')).toBe(16);
    expect(clueFontSize('A long, determined campaign for a cause; originally a medieval expedition')).toBe(15);
  });

  it('times read like 1:21', () => {
    expect(formatTime(81)).toBe('1:21');
    expect(formatTime(5)).toBe('0:05');
  });

  it('the shared result says how it went, with a link to the game', () => {
    expect(shareText("Today's Knowledge Mix", true, 81, 0)).toBe(
      "I solved today's AI Mini Crossword in 1:21 with no help! https://ai-mini-crossword.onrender.com"
    );
    expect(shareText('History', false, 125, 2)).toBe(
      'I solved a History puzzle on AI Mini Crossword in 2:05 with 2 answers shown! https://ai-mini-crossword.onrender.com'
    );
  });
});
