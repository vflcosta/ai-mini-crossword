/**
 * Turning the backend's JSON into the puzzle the player sees.
 */
import { describe, expect, it } from 'vitest';
import { backendToCrossword } from '../utils/transform';
import type { BackendPayload } from '../types/api';

// P L A N T
// # E # # R
// # A # # E
// # F # # E
// # # # # #
const PLANT: BackendPayload = {
  grid: [
    ['P', 'L', 'A', 'N', 'T'],
    ['#', 'E', '#', '#', 'R'],
    ['#', 'A', '#', '#', 'E'],
    ['#', 'F', '#', '#', 'E'],
    ['#', '#', '#', '#', '#'],
  ],
  clues: {
    across: [{ number: 1, clue: 'It grows in a pot', answer: 'PLANT' }],
    down: [
      { number: 2, clue: 'It falls in autumn', answer: 'LEAF' },
      { number: 3, clue: 'It has a trunk', answer: 'TREE' },
    ],
  },
};

describe('backendToCrossword: the grid', () => {
  it('keeps the grid size and the theme label', () => {
    const cw = backendToCrossword(PLANT, 'Nature');
    expect(cw.size).toBe(5);
    expect(cw.theme).toBe('Nature');
    expect(cw.grid).toHaveLength(5);
    cw.grid.forEach((row) => expect(row).toHaveLength(5));
  });

  it('turns "#" into black squares and letters into playable squares', () => {
    const cw = backendToCrossword(PLANT, 'Nature');
    expect(cw.grid[0].map((c) => c.letter).join('')).toBe('PLANT');
    expect(cw.grid[0].every((c) => !c.isBlack)).toBe(true);
    expect(cw.grid[1][0].isBlack).toBe(true);
    expect(cw.grid[4].every((c) => c.isBlack)).toBe(true);
  });

  it('uppercases lowercase letters', () => {
    const cw = backendToCrossword(
      { grid: [['c', 'a', 't'], ['#', '#', '#'], ['#', '#', '#']], clues: { across: [], down: [] } },
      'x'
    );
    expect(cw.grid[0].map((c) => c.letter).join('')).toBe('CAT');
  });

  it('treats junk cells (empty, digits, several characters, missing) as black squares', () => {
    const cw = backendToCrossword(
      {
        grid: [['', '7', 'AB'], [' ', '?', '#'], ['C'] as string[]],
        clues: { across: [], down: [] },
      },
      'x'
    );
    const black = cw.grid.flat().filter((c) => c.isBlack).length;
    expect(black).toBe(8);
    expect(cw.grid[2][0]).toMatchObject({ letter: 'C' });
  });
});

describe('backendToCrossword: numbering', () => {
  it('numbers word starts left to right, top to bottom', () => {
    const cw = backendToCrossword(PLANT, 'Nature');
    expect(cw.grid[0][0].number).toBe(1); // PLANT
    expect(cw.grid[0][1].number).toBe(2); // LEAF
    expect(cw.grid[0][4].number).toBe(3); // TREE
    const numbered = cw.grid.flat().filter((c) => c.number !== undefined).length;
    expect(numbered).toBe(3);
  });

  it('gives one shared number to a square that starts both an across and a down word', () => {
    const cw = backendToCrossword(
      {
        grid: [['C', 'A', 'T'], ['O', '#', '#'], ['W', '#', '#']],
        clues: {
          across: [{ clue: 'Feline pet', answer: 'CAT' }],
          down: [{ clue: 'It moos', answer: 'COW' }],
        },
      },
      'x'
    );
    expect(cw.clues.across[0].number).toBe(1);
    expect(cw.clues.down[0].number).toBe(1);
  });

  it('does not number two-letter runs', () => {
    const cw = backendToCrossword(
      {
        grid: [['C', 'A', 'T'], ['#', '#', 'O'], ['#', '#', '#']],
        clues: { across: [{ clue: 'Feline pet', answer: 'CAT' }], down: [] },
      },
      'x'
    );
    expect(cw.grid[0][2].number).toBeUndefined();
    expect(cw.clues.down).toHaveLength(0);
  });
});

describe('backendToCrossword: clues', () => {
  it('attaches each clue to its position, direction and answer', () => {
    const cw = backendToCrossword(PLANT, 'Nature');
    expect(cw.clues.across).toEqual([
      { number: 1, clue: 'It grows in a pot', answer: 'PLANT', row: 0, col: 0, direction: 'across' },
    ]);
    expect(cw.clues.down).toEqual([
      { number: 2, clue: 'It falls in autumn', answer: 'LEAF', row: 0, col: 1, direction: 'down' },
      { number: 3, clue: 'It has a trunk', answer: 'TREE', row: 0, col: 4, direction: 'down' },
    ]);
  });

  it('every answer has the same letters as the squares it covers', () => {
    const cw = backendToCrossword(PLANT, 'Nature');
    for (const clue of [...cw.clues.across, ...cw.clues.down]) {
      const letters = clue.answer.split('').map((_, i) =>
        clue.direction === 'across'
          ? cw.grid[clue.row][clue.col + i].letter
          : cw.grid[clue.row + i][clue.col].letter
      );
      expect(letters.join('')).toBe(clue.answer);
    }
  });

  it.each(['Clue to fill', '(clue)', '', '   '])(
    'replaces the placeholder clue %j with a safe message',
    (junk) => {
      const cw = backendToCrossword(
        { ...PLANT, clues: { ...PLANT.clues, across: [{ clue: junk, answer: 'PLANT' }] } },
        'Nature'
      );
      expect(cw.clues.across[0].clue).toBe('(no clue from generator)');
    }
  );

  it('does not crash when the backend sends fewer clues than words in the grid', () => {
    const cw = backendToCrossword({ ...PLANT, clues: { across: [], down: [] } }, 'Nature');
    expect(cw.clues.across).toEqual([]);
    expect(cw.clues.down).toEqual([]);
  });

  it.fails(
    'KNOWN BUG: a numbered square always has a clue (today a missing clue leaves a numbered square with nothing to show)',
    () => {
      const cw = backendToCrossword({ ...PLANT, clues: { across: PLANT.clues.across, down: [] } }, 'Nature');
      const clueNumbers = new Set([...cw.clues.across, ...cw.clues.down].map((c) => c.number));
      const gridNumbers = cw.grid.flat().flatMap((c) => (c.number ? [c.number] : []));
      gridNumbers.forEach((n) => expect(clueNumbers.has(n)).toBe(true));
    }
  );
});
