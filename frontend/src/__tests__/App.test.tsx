/**
 * Playing the game, the way a real user would: click, type, solve.
 * The backend is faked, so these tests need no server and no AI.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { generateCrossword } from '../api';
import type { BackendPayload } from '../types/api';

vi.mock('../api', () => ({ generateCrossword: vi.fn() }));
const generateMock = vi.mocked(generateCrossword);

// P L A N T      1 across: PLANT
// # E # # R      2 down:   LEAF
// # A # # E      3 down:   TREE
// # F # # E
// # # # # #
const PUZZLE: BackendPayload = {
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
// The white squares in reading order, and the letter that belongs in each.
const SOLUTION = 'PLANT' + 'ER' + 'AE' + 'FE';
const SQUARE = { P: 0, L: 1, A: 2, N: 3, T: 4, E_of_LEAF: 5, R_of_TREE: 6 };

const squares = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[maxlength="1"]'));
const type = (index: number, letter: string) =>
  fireEvent.change(squares()[index], { target: { value: letter } });
const click = (index: number) => fireEvent.click(squares()[index]);

async function startRandomPuzzle() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /random knowledge mix/i }));
  await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
}

beforeEach(() => {
  generateMock.mockReset();
  generateMock.mockResolvedValue(PUZZLE);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('home screen', () => {
  it('shows the title and both ways to start', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'AI Mini Crossword' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate from Theme' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /random knowledge mix/i })).toBeEnabled();
  });

  it('"Random Knowledge Mix" asks for a 7x7 puzzle with no theme and opens the game', async () => {
    await startRandomPuzzle();
    expect(generateMock).toHaveBeenCalledWith(null, 7);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('"Generate from Theme" sends the typed theme, without extra spaces', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/enter a theme/i), {
      target: { value: '  space  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate from Theme' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenCalledWith('space', 7);
  });

  it('blocks the buttons while a puzzle is being generated', async () => {
    let finish!: (p: BackendPayload) => void;
    generateMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /random knowledge mix/i }));
    expect(await screen.findByRole('button', { name: 'Generating...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /random knowledge mix/i })).toBeDisabled();
    finish(PUZZLE);
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
  });

  it('tells the user and stays on the home screen when generation fails', async () => {
    generateMock.mockRejectedValue(new Error('Backend error: 500'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /random knowledge mix/i }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Could not generate crossword.'));
    expect(screen.getByRole('heading', { name: 'AI Mini Crossword' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /random knowledge mix/i })).toBeEnabled();
  });

  it('tapping a theme chip like "Coffee" generates a Coffee puzzle', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Coffee' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(generateMock).toHaveBeenCalledWith('Coffee', 7);
  });

  it('"Reset" after a theme chip keeps the same theme', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Space' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(2));
    expect(generateMock).toHaveBeenLastCalledWith('Space', 7);
  });
});

describe('clues', () => {
  it('asks the player to pick a square first', async () => {
    await startRandomPuzzle();
    expect(screen.getByText('Select a clue')).toBeInTheDocument();
  });

  it('clicking a square shows its across clue and length', async () => {
    await startRandomPuzzle();
    click(SQUARE.A);
    expect(screen.getByText('It grows in a pot')).toBeInTheDocument();
    expect(screen.getByText(/Across • 5 letters/)).toBeInTheDocument();
  });

  it('clicking the same square again switches to the down clue', async () => {
    await startRandomPuzzle();
    click(SQUARE.L);
    click(SQUARE.L);
    expect(screen.getByText('It falls in autumn')).toBeInTheDocument();
    expect(screen.getByText(/Down • 4 letters/)).toBeInTheDocument();
  });

  it('a square that only belongs to a down word shows the down clue', async () => {
    await startRandomPuzzle();
    click(SQUARE.R_of_TREE);
    expect(screen.getByText('It has a trunk')).toBeInTheDocument();
  });

  it('Next and Previous walk through the clues in number order', async () => {
    await startRandomPuzzle();
    click(SQUARE.P);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('It falls in autumn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('It has a trunk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // already last
    expect(screen.getByText('It has a trunk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText('It falls in autumn')).toBeInTheDocument();
  });

  it('the answer stays hidden until "Reveal answer" is pressed', async () => {
    await startRandomPuzzle();
    click(SQUARE.P);
    expect(screen.queryByText('PLANT')).not.toBeInTheDocument();
    expect(screen.getByText('•••••')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    expect(screen.getByText('PLANT')).toBeInTheDocument();
    expect(screen.getByText('revealed')).toBeInTheDocument();
  });
});

describe('typing', () => {
  it('shows typed letters in capitals', async () => {
    await startRandomPuzzle();
    type(SQUARE.P, 'p');
    expect(squares()[SQUARE.P]).toHaveValue('P');
  });

  it('moves to the next square after a letter in an across word', async () => {
    await startRandomPuzzle();
    click(SQUARE.P);
    type(SQUARE.P, 'P');
    expect(squares()[SQUARE.L]).toHaveFocus();
  });

  it('Backspace clears the current square', async () => {
    await startRandomPuzzle();
    type(SQUARE.A, 'A');
    fireEvent.keyDown(squares()[SQUARE.A], { key: 'Backspace' });
    expect(squares()[SQUARE.A]).toHaveValue('');
  });

  it('Backspace on an empty square goes back and clears the previous one', async () => {
    await startRandomPuzzle();
    type(SQUARE.P, 'P');
    fireEvent.keyDown(squares()[SQUARE.L], { key: 'Backspace' });
    expect(squares()[SQUARE.P]).toHaveValue('');
    expect(squares()[SQUARE.P]).toHaveFocus();
  });

  it('arrow keys move between squares and stop at black squares', async () => {
    await startRandomPuzzle();
    click(SQUARE.L);
    fireEvent.keyDown(squares()[SQUARE.L], { key: 'ArrowDown' });
    expect(squares()[SQUARE.E_of_LEAF]).toHaveFocus();
    fireEvent.keyDown(squares()[SQUARE.E_of_LEAF], { key: 'ArrowLeft' }); // black square
    expect(squares()[SQUARE.E_of_LEAF]).toHaveFocus();
    fireEvent.keyDown(squares()[SQUARE.E_of_LEAF], { key: 'ArrowUp' });
    expect(squares()[SQUARE.L]).toHaveFocus();
  });

  it('typing in a down word moves the cursor down', async () => {
    await startRandomPuzzle();
    click(SQUARE.L);
    click(SQUARE.L); // switch to the down word LEAF
    type(SQUARE.L, 'L');
    expect(squares()[SQUARE.E_of_LEAF]).toHaveFocus();
    expect(screen.getByText('It falls in autumn')).toBeInTheDocument();
  });

  it('the cursor stays put at the end of a down word', async () => {
    await startRandomPuzzle();
    const lastOfTree = SOLUTION.length - 1;
    click(lastOfTree);
    type(lastOfTree, 'E');
    expect(squares()[lastOfTree]).toHaveFocus();
  });

  it('Backspace in a down word goes back up', async () => {
    await startRandomPuzzle();
    click(SQUARE.L);
    click(SQUARE.L); // switch to the down word LEAF
    type(SQUARE.L, 'L');
    fireEvent.keyDown(squares()[SQUARE.E_of_LEAF], { key: 'Backspace' });
    expect(squares()[SQUARE.L]).toHaveFocus();
    expect(squares()[SQUARE.L]).toHaveValue('');
  });
});

describe('finishing the puzzle', () => {
  const fillAll = (letters: string) => letters.split('').forEach((ch, i) => type(i, ch));

  it('celebrates when every square is correct', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    expect(await screen.findByText(/puzzle complete/i)).toBeInTheDocument();
    expect(screen.getByText(/You solved it in 0:0\d\./)).toBeInTheDocument();
  });

  it('accepts lowercase typing', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION.toLowerCase());
    expect(await screen.findByText(/puzzle complete/i)).toBeInTheDocument();
  });

  it('does not celebrate while a square is wrong or empty', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION.slice(0, -1) + 'X');
    expect(screen.queryByText(/puzzle complete/i)).not.toBeInTheDocument();
    type(SOLUTION.length - 1, '');
    expect(screen.queryByText(/puzzle complete/i)).not.toBeInTheDocument();
    type(SOLUTION.length - 1, 'E');
    expect(await screen.findByText(/puzzle complete/i)).toBeInTheDocument();
  });

  it('"Review" closes the celebration and keeps the solved grid', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    expect(screen.queryByText(/puzzle complete/i)).not.toBeInTheDocument();
    expect(squares().map((s) => s.value).join('')).toBe(SOLUTION);
  });

  it('"Back to Home" returns to the home screen', async () => {
    await startRandomPuzzle();
    fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
    expect(screen.getByRole('button', { name: /random knowledge mix/i })).toBeInTheDocument();
    expect(squares()).toHaveLength(0);
  });

  it('"Reset" loads a fresh puzzle with an empty grid', async () => {
    await startRandomPuzzle();
    type(SQUARE.P, 'P');
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(squares()[SQUARE.P]).toHaveValue(''));
  });
});
