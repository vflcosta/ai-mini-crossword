/**
 * Playing the game, the way a real user would: tap, type, solve.
 * The backend is faked, so these tests need no server and no AI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App, { limitNotice, puzzleDateLabel, timeUntil } from '../App';
import { fetchFeaturedAngles, generateCrossword, LimitReachedError } from '../api';
import { track } from '../analytics';
import type { BackendPayload } from '../types/api';

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  generateCrossword: vi.fn(),
  fetchFeaturedAngles: vi.fn(),
}));
const generateMock = vi.mocked(generateCrossword);
const anglesMock = vi.mocked(fetchFeaturedAngles);
const ANGLES = {
  History: 'Samurai Japan', Space: 'The Moon', Art: 'Photography',
  Nature: 'Big cats', Science: 'Atoms', Music: 'Musicals',
};

vi.mock('../analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../analytics')>()),
  track: vi.fn(),
}));
const trackMock = vi.mocked(track);

// Android's Back button: the test presses it by calling the game's handler
const androidBack = vi.hoisted(() => ({ press: null as null | (() => boolean) }));
vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  onAndroidBack: (handler: () => boolean) => {
    androidBack.press = handler;
    return () => {};
  },
}));

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
  Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-square]'));
/** The letter in a square (without its clue number). */
const letterIn = (square: HTMLElement) =>
  Array.from(square.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent)
    .join('');
const letters = () => squares().map(letterIn).join('');
const tap = (index: number) => fireEvent.click(squares()[index]);
/** Press a key on the game's own A–Z keyboard. */
const press = (letter: string) =>
  fireEvent.click(screen.getByRole('button', { name: letter }));
const pressDelete = () => fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
/** Press a key on a physical keyboard. */
const keyDown = (key: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(window, { key, ...extra });
const current = () => squares().findIndex((s) => s.classList.contains('is-current'));
const bar = () => screen.queryByRole('region', { name: 'Current clue' });
const sheet = () => screen.queryByRole('dialog', { name: 'Puzzle complete' });
/** Fill every square with the given letters, in reading order. */
const fillAll = (text: string) =>
  text.split('').forEach((ch, i) => {
    if (current() !== i) tap(i);
    keyDown(ch);
  });

async function startRandomPuzzle() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: "Play today's puzzle" }));
  await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
}

beforeEach(() => {
  generateMock.mockReset();
  trackMock.mockReset();
  generateMock.mockResolvedValue(PUZZLE);
  anglesMock.mockReset();
  anglesMock.mockResolvedValue({});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('home screen', () => {
  it('shows the title, the tagline, and today\'s puzzle as the main action', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'AI Mini Crossword' })).toBeInTheDocument();
    expect(screen.getByText('Daily brain play!')).toBeInTheDocument();
    expect(
      screen.getByText('Challenge your mind with daily, themed mini crosswords.')
    ).toBeInTheDocument();
    const play = screen.getByRole('button', { name: "Play today's puzzle" });
    expect(play).toBeEnabled();
    expect(play).toHaveClass('primary-btn');
    // today's puzzle comes before the theme options
    const theme = screen.getByRole('heading', { name: 'Or pick a theme' });
    expect(play.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows today\'s date on the daily puzzle', () => {
    render(<App />);
    expect(screen.getByText(puzzleDateLabel())).toBeInTheDocument();
    expect(puzzleDateLabel(new Date('2026-11-14T23:30:00Z'))).toBe('Sunday 15 November');
  });

  it('"Create puzzle" needs a theme first', () => {
    render(<App />);
    const create = screen.getByRole('button', { name: 'Create puzzle' });
    expect(create).toBeDisabled();
    fireEvent.keyDown(screen.getByPlaceholderText(/type any theme/i), { key: 'Enter' });
    expect(generateMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/type any theme/i), { target: { value: 'jazz' } });
    expect(create).toBeEnabled();
  });

  it('explains how it works in three steps', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument();
    expect(document.querySelectorAll('.how-list li')).toHaveLength(3);
  });

  it('describes the puzzles as 7×7', () => {
    render(<App />);
    expect(screen.getByText(/A fresh 7×7 puzzle every day/)).toBeInTheDocument();
    expect(screen.getByText(/A 7×7 mini crossword, made fresh by AI/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('5×5');
  });

  it('"Play today\'s puzzle" asks for a 7x7 puzzle with no theme and opens the game', async () => {
    await startRandomPuzzle();
    expect(generateMock).toHaveBeenCalledWith(null, 7);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('"Create puzzle" sends the typed theme, without extra spaces', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/type any theme/i), {
      target: { value: '  space  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create puzzle' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenCalledWith('space', 7);
  });

  it('shows a loading screen with a skeleton grid while the puzzle is being made', async () => {
    let finish!: (p: BackendPayload) => void;
    generateMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    const loader = await screen.findByRole('status');
    expect(loader).toHaveTextContent('Creating your History crossword…');
    expect(loader).toHaveTextContent('This can take up to 1 minute');
    expect(document.querySelectorAll('.skeleton-cell')).toHaveLength(49);
    // the home screen is hidden, so nothing can be started twice
    expect(screen.queryByRole('button', { name: 'Create puzzle' })).not.toBeInTheDocument();
    expect(generateMock).toHaveBeenCalledTimes(1);

    finish(PUZZLE);
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(document.querySelector('.skeleton-cell')).toBeNull();
  });

  it("the loading screen names today's puzzle", async () => {
    generateMock.mockReturnValue(new Promise(() => {}));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: "Play today's puzzle" }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Creating your Today's Knowledge Mix crossword…"
    );
  });

  it('the loading screen goes away and the typed theme is kept when generation fails', async () => {
    generateMock.mockRejectedValue(new Error('Backend error: 500'));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/type any theme/i), { target: { value: 'jazz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create puzzle' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(document.querySelector('.skeleton-cell')).toBeNull();
    expect(screen.getByPlaceholderText(/type any theme/i)).toHaveValue('jazz');
  });

  it('tells the user on the page (no pop-up) and stays on the home screen when generation fails', async () => {
    generateMock.mockRejectedValue(new Error('Backend error: 500'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: "Play today's puzzle" }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't make that puzzle");
    expect(window.alert).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'AI Mini Crossword' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Play today's puzzle" })).toBeEnabled();
  });

  it('pressing Enter in the theme box generates the puzzle', async () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/type any theme/i);
    fireEvent.change(input, { target: { value: 'jazz' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(generateMock).toHaveBeenCalledWith('jazz', 7));
  });

  it('tapping a theme chip like "History" generates a History puzzle', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(generateMock).toHaveBeenCalledWith('History', 7);
  });


});

describe('featured themes', () => {
  it('six themes, including Music, each with its own picture', () => {
    render(<App />);
    const tiles = document.querySelectorAll('.theme-tile');
    expect(Array.from(tiles).map((t) => t.getAttribute('aria-label'))).toEqual([
      'History', 'Space', 'Art', 'Nature', 'Science', 'Music',
    ]);
    expect(screen.getByRole('button', { name: 'Music' })).toHaveTextContent('🎵');
  });

  it("shows today's angle under each theme", async () => {
    anglesMock.mockResolvedValue(ANGLES);
    render(<App />);
    expect(await screen.findByText('Samurai Japan')).toBeInTheDocument();
    expect(screen.getByText('Musicals')).toBeInTheDocument();
    // screen readers hear the plain name, then the angle as a description
    const history = screen.getByRole('button', { name: 'History' });
    expect(history).toHaveAccessibleDescription('Samurai Japan');
  });

  it('the themes still work when the angles cannot be loaded', async () => {
    render(<App />);
    await waitFor(() => expect(anglesMock).toHaveBeenCalled());
    expect(document.querySelector('.theme-tile-angle')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Music' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenCalledWith('Music', 7);
  });

  it('the loading screen names the theme and its angle', async () => {
    anglesMock.mockResolvedValue(ANGLES);
    generateMock.mockReturnValue(new Promise(() => {}));
    render(<App />);
    await screen.findByText('The Moon');
    fireEvent.click(screen.getByRole('button', { name: 'Space' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Creating your Space · The Moon crossword…'
    );
  });

  it('says the featured themes are free, with a new angle every day', () => {
    render(<App />);
    expect(screen.getByText('Free to play · a new angle every day')).toBeInTheDocument();
  });
});

describe('theme box after a puzzle', () => {
  const themeBox = () => screen.getByPlaceholderText('Type any theme') as HTMLInputElement;

  it('is empty again when the player comes back from a puzzle about their own theme', async () => {
    render(<App />);
    fireEvent.change(themeBox(), { target: { value: 'volcanoes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create puzzle' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(themeBox()).toHaveValue('');
  });

  it('is empty again after a featured theme too', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Art' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(themeBox()).toHaveValue('');
  });
});

describe('the clue bar', () => {
  it('opens on the first clue, with its number, direction and length', async () => {
    await startRandomPuzzle();
    expect(bar()).toHaveTextContent('1 across · 5 letters');
    expect(bar()).toHaveTextContent('It grows in a pot');
    expect(current()).toBe(SQUARE.P);
  });

  it('tapping a square shows its across clue', async () => {
    await startRandomPuzzle();
    tap(SQUARE.R_of_TREE);
    tap(SQUARE.A);
    expect(bar()).toHaveTextContent('It grows in a pot');
    expect(current()).toBe(SQUARE.A);
  });

  it('tapping the same square again switches to the down clue', async () => {
    await startRandomPuzzle();
    tap(SQUARE.L);
    tap(SQUARE.L);
    expect(bar()).toHaveTextContent('2 down · 4 letters');
    expect(bar()).toHaveTextContent('It falls in autumn');
  });

  it('tapping the clue switches between across and down', async () => {
    await startRandomPuzzle();
    tap(SQUARE.L);
    fireEvent.click(screen.getByRole('button', { name: /Tap to switch between across and down/ }));
    expect(bar()).toHaveTextContent('It falls in autumn');
    fireEvent.click(screen.getByRole('button', { name: /Tap to switch between across and down/ }));
    expect(bar()).toHaveTextContent('It grows in a pot');
  });

  it('a square that only belongs to a down word shows the down clue', async () => {
    await startRandomPuzzle();
    tap(SQUARE.R_of_TREE);
    expect(bar()).toHaveTextContent('3 down · 4 letters');
    expect(bar()).toHaveTextContent('It has a trunk');
  });

  it('its arrows walk through the clues in number order and wrap around', async () => {
    await startRandomPuzzle();
    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next clue' }));
    next();
    expect(bar()).toHaveTextContent('It falls in autumn');
    next();
    expect(bar()).toHaveTextContent('It has a trunk');
    next(); // from the last clue back to the first
    expect(bar()).toHaveTextContent('It grows in a pot');
    fireEvent.click(screen.getByRole('button', { name: 'Previous clue' }));
    expect(bar()).toHaveTextContent('It has a trunk');
  });

  it('moving to a clue puts the cursor on its first empty square', async () => {
    await startRandomPuzzle();
    press('P');
    press('L'); // P and L of PLANT; L is also the first letter of LEAF
    fireEvent.click(screen.getByRole('button', { name: 'Next clue' }));
    expect(bar()).toHaveTextContent('It falls in autumn');
    expect(current()).toBe(SQUARE.E_of_LEAF);
  });

  it('long clues stay readable: up to 3 lines, with smaller text', async () => {
    const long = 'A long, determined campaign for a cause; originally a medieval military expedition';
    generateMock.mockResolvedValue({
      ...PUZZLE,
      clues: { ...PUZZLE.clues, across: [{ number: 1, clue: long, answer: 'PLANT' }] },
    });
    await startRandomPuzzle();
    const text = screen.getByText(long);
    expect(text).toHaveClass('clue-bar-clue'); // limited to 3 lines in the stylesheet
    expect(text).toHaveStyle({ fontSize: '15px' });
    tap(SQUARE.L);
    tap(SQUARE.L);
    expect(screen.getByText('It falls in autumn')).toHaveStyle({ fontSize: '17px' });
  });
});

describe("the game's own keyboard", () => {
  it('has all 26 letters and Delete, and no text box opens the phone keyboard', async () => {
    await startRandomPuzzle();
    const keyboard = screen.getByLabelText('Letter keyboard');
    expect(keyboard.querySelectorAll('button')).toHaveLength(27);
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(screen.getByRole('button', { name: letter })).toBeInTheDocument();
    }
    expect(document.querySelector('input, textarea, [contenteditable]')).toBeNull();
  });

  it('a letter goes in the current square and the cursor moves on', async () => {
    await startRandomPuzzle();
    press('P');
    expect(letterIn(squares()[SQUARE.P])).toBe('P');
    expect(current()).toBe(SQUARE.L);
  });

  it('typing skips squares that are already filled', async () => {
    await startRandomPuzzle();
    tap(SQUARE.L);
    tap(SQUARE.L); // LEAF, down
    press('L');
    tap(SQUARE.P);
    tap(SQUARE.P); // back to PLANT, across
    press('P');
    expect(current()).toBe(SQUARE.A); // the L was already there
  });

  it('a finished word jumps to the next unfinished clue', async () => {
    await startRandomPuzzle();
    'PLANT'.split('').forEach(press);
    expect(bar()).toHaveTextContent('It falls in autumn');
    expect(current()).toBe(SQUARE.E_of_LEAF);
  });

  it('typing on a filled square replaces its letter', async () => {
    await startRandomPuzzle();
    press('X');
    tap(SQUARE.P);
    press('P');
    expect(letterIn(squares()[SQUARE.P])).toBe('P');
  });

  it('Delete clears the square, or steps back and clears the one before', async () => {
    await startRandomPuzzle();
    press('P');
    press('L');
    tap(SQUARE.L);
    tap(SQUARE.L);
    tap(SQUARE.L); // back to PLANT, across, on the L
    pressDelete();
    expect(letterIn(squares()[SQUARE.L])).toBe('');
    expect(current()).toBe(SQUARE.L);
    pressDelete(); // empty: step back to P and clear it
    expect(current()).toBe(SQUARE.P);
    expect(letterIn(squares()[SQUARE.P])).toBe('');
  });
});

describe('a physical keyboard', () => {
  it('types letters (in any case) and deletes with Backspace', async () => {
    await startRandomPuzzle();
    keyDown('p');
    keyDown('l');
    expect(letters().slice(0, 2)).toBe('PL');
    keyDown('Backspace'); // the cursor is on the empty A: step back and clear the L
    expect(letters()).toBe('P');
    expect(current()).toBe(SQUARE.L);
  });

  it('ignores digits, symbols and shortcuts like Ctrl+A', async () => {
    await startRandomPuzzle();
    keyDown('5');
    keyDown('!');
    keyDown('a', { ctrlKey: true });
    keyDown('c', { metaKey: true });
    expect(letters()).toBe('');
  });

  it('arrow keys move between squares and stop at black squares', async () => {
    await startRandomPuzzle();
    tap(SQUARE.L);
    keyDown('ArrowDown');
    expect(current()).toBe(SQUARE.E_of_LEAF);
    keyDown('ArrowLeft'); // black square to the left: stay
    expect(current()).toBe(SQUARE.E_of_LEAF);
    keyDown('ArrowUp');
    keyDown('ArrowRight');
    expect(current()).toBe(SQUARE.A);
  });
});

describe('show answer (the light bulb)', () => {
  const bulb = () => screen.getByRole('button', { name: /Show answer for this clue|Hide answer/ });

  it('shows the answer in the clue bar without filling the grid', async () => {
    await startRandomPuzzle();
    fireEvent.click(bulb());
    expect(bar()).toHaveTextContent('Answer');
    expect(bar()).toHaveTextContent('PLANT');
    expect(bulb()).toHaveAttribute('aria-pressed', 'true');
    expect(letters()).toBe('');
  });

  it('tapping it again hides the answer', async () => {
    await startRandomPuzzle();
    fireEvent.click(bulb());
    fireEvent.click(bulb());
    expect(bar()).toHaveTextContent('1 across · 5 letters');
    expect(bulb()).toHaveAttribute('aria-pressed', 'false');
  });

  it('letters typed while the answer is on show get a corner flag', async () => {
    await startRandomPuzzle();
    fireEvent.click(bulb());
    press('P');
    fireEvent.click(bulb()); // hide it
    press('L');
    expect(squares()[SQUARE.P].querySelector('[data-flag]')).not.toBeNull();
    expect(squares()[SQUARE.L].querySelector('[data-flag]')).toBeNull();
  });
});

describe('finishing the puzzle', () => {
  it('shows the results when every square is right, and the clock stops', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    expect(await screen.findByRole('heading', { name: 'Puzzle complete!' })).toBeInTheDocument();
    expect(sheet()).toHaveTextContent(/You solved today's puzzle in 0:0\d\./);
    expect(screen.getByText(/^Solved in 0:0\d$/)).toBeInTheDocument();
  });

  it('celebrates with letter tiles spelling YAY (decoration, hidden from screen readers)', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    const celebration = screen.getByTestId('celebration');
    expect(celebration).toHaveAttribute('aria-hidden', 'true');
    expect(Array.from(celebration.querySelectorAll('.celebrate-tile')).map((t) => t.textContent).join('')).toBe('YAY');
    expect(celebration.querySelectorAll('.celebrate-piece').length).toBeGreaterThan(0);
  });

  it('names the theme for a themed puzzle', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    fillAll(SOLUTION);
    expect(await screen.findByText(/You solved the History puzzle in/)).toBeInTheDocument();
  });

  it('accepts lowercase typing', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION.toLowerCase());
    expect(sheet()).toBeInTheDocument();
  });

  it('does not finish while a square is wrong or empty', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION.slice(0, -1) + 'X');
    expect(sheet()).not.toBeInTheDocument();
    pressDelete();
    expect(sheet()).not.toBeInTheDocument();
    keyDown('E');
    expect(sheet()).toBeInTheDocument();
  });

  it('says "No help used" when no answer was shown', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    expect(sheet()).toHaveTextContent('No help used');
  });

  it('counts the answers shown, each clue once', async () => {
    await startRandomPuzzle();
    const bulb = () => screen.getByRole('button', { name: /Show answer for this clue|Hide answer/ });
    fireEvent.click(bulb());
    fireEvent.click(bulb());
    fireEvent.click(bulb()); // the same clue, shown twice
    tap(SQUARE.R_of_TREE);
    fireEvent.click(bulb());
    fillAll(SOLUTION);
    expect(sheet()).toHaveTextContent('2Answers shown');
  });

  it('the keyboard goes away and letters can no longer be changed', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    expect(screen.queryByLabelText('Letter keyboard')).not.toBeInTheDocument();
    keyDown('Backspace');
    expect(letters()).toBe(SOLUTION);
  });

  it('"Review puzzle" shows the solved grid, and "Results" brings the results back', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    fireEvent.click(screen.getByRole('button', { name: 'Review puzzle' }));
    expect(sheet()).not.toBeInTheDocument();
    expect(screen.getByText('Reviewing · tap any square or use the arrows')).toBeInTheDocument();
    expect(letters()).toBe(SOLUTION);
    expect(bar()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show answer/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Results' }));
    expect(sheet()).toBeInTheDocument();
  });

  it('"Back to home" returns to the home screen, and the next puzzle starts fresh', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(screen.getByRole('button', { name: "Play today's puzzle" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(sheet()).not.toBeInTheDocument();
    expect(letters()).toBe('');
    expect(screen.getByText('0:00')).toBeInTheDocument();
    fillAll(SOLUTION);
    expect(sheet()).toBeInTheDocument();
  });

  it('"Reset" starts the same puzzle again without asking for a new one', async () => {
    await startRandomPuzzle();
    fireEvent.click(screen.getByRole('button', { name: 'Show answer for this clue' }));
    press('P');
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(letters()).toBe('');
    expect(document.querySelector('[data-flag]')).toBeNull();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(current()).toBe(SQUARE.P);
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it('"Share result" uses the phone\'s share menu', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await startRandomPuzzle();
    fillAll(SOLUTION);
    fireEvent.click(screen.getByRole('button', { name: 'Share result' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].text).toMatch(
      /^I solved today's AI Mini Crossword in 0:0\d with no help! https:\/\/ai-mini-crossword\.onrender\.com$/
    );
    // @ts-expect-error remove the stand-in again
    delete navigator.share;
  });

  it('"Share result" copies the text where there is no share menu', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await startRandomPuzzle();
    fillAll(SOLUTION);
    fireEvent.click(screen.getByRole('button', { name: 'Share result' }));
    expect(await screen.findByText('Copied, ready to paste')).toBeInTheDocument();
    expect(writeText.mock.calls[0][0]).toContain('AI Mini Crossword');
  });

  it('"Share result" says so when the result could not be shared', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
      configurable: true,
    });
    await startRandomPuzzle();
    fillAll(SOLUTION);
    fireEvent.click(screen.getByRole('button', { name: 'Share result' }));
    expect(await screen.findByText("Couldn't share this time. Please try again.")).toBeInTheDocument();
  });

  it('"Back to Home" at the top leaves the puzzle at any time', async () => {
    await startRandomPuzzle();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(screen.getByRole('button', { name: "Play today's puzzle" })).toBeInTheDocument();
    expect(squares()).toHaveLength(0);
  });
});

describe('look and feel', () => {
  it('the square being filled in and the rest of its word are highlighted', async () => {
    await startRandomPuzzle();
    tap(SQUARE.A); // PLANT across
    expect(squares()[SQUARE.A]).toHaveClass('is-current');
    expect(squares()[SQUARE.P]).toHaveClass('is-word');
    expect(squares()[SQUARE.E_of_LEAF]).not.toHaveClass('is-word');

    tap(SQUARE.L);
    tap(SQUARE.L); // LEAF down
    expect(squares()[SQUARE.E_of_LEAF]).toHaveClass('is-word');
    expect(squares()[SQUARE.P]).not.toHaveClass('is-word');
  });

  it('every square says where it is and what it holds, for screen readers', async () => {
    await startRandomPuzzle();
    press('P');
    expect(squares()[SQUARE.P]).toHaveAccessibleName('Row 1, column 1, P');
    expect(squares()[SQUARE.L]).toHaveAccessibleName('Row 1, column 2, empty');
    expect(screen.getAllByRole('button', { name: 'Black square' })[0]).toBeDisabled();
  });

  it('featured theme buttons keep their plain names for screen readers', () => {
    render(<App />);
    for (const name of ['History', 'Space', 'Art', 'Nature', 'Science', 'Music']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('the privacy policy shows the contact address', () => {
    window.location.hash = '#privacy';
    render(<App />);
    expect(screen.getByRole('link', { name: 'aiminicrosswordpuzzle@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:aiminicrosswordpuzzle@gmail.com'
    );
    window.location.hash = '';
  });
});

describe('desktop layout', () => {
  const asDesktop = () =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );

  afterEach(() => vi.unstubAllGlobals());

  it('phones get the keyboard and no clue lists', async () => {
    await startRandomPuzzle();
    expect(screen.getByLabelText('Letter keyboard')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Across clues' })).not.toBeInTheDocument();
  });

  it('wide screens list every clue next to the grid, and type with the real keyboard', async () => {
    asDesktop();
    await startRandomPuzzle();
    expect(screen.getByRole('region', { name: 'Across clues' })).toHaveTextContent('It grows in a pot');
    const down = screen.getByRole('region', { name: 'Down clues' });
    expect(down).toHaveTextContent('It falls in autumn');
    expect(down).toHaveTextContent('It has a trunk');
    expect(screen.queryByLabelText('Letter keyboard')).not.toBeInTheDocument();
    keyDown('P');
    expect(letterIn(squares()[SQUARE.P])).toBe('P');
  });

  it('clicking a clue in the list jumps to it in the grid', async () => {
    asDesktop();
    await startRandomPuzzle();
    const item = within(screen.getByRole('region', { name: 'Down clues' })).getByRole('button', {
      name: /It has a trunk/,
    });
    fireEvent.click(item);
    expect(item).toHaveAttribute('aria-current', 'true');
    expect(bar()).toHaveTextContent('3 down · 4 letters');
    keyDown('T');
    expect(current()).toBe(SQUARE.R_of_TREE);
  });

  it('the list follows the clue being solved and marks answers shown', async () => {
    asDesktop();
    await startRandomPuzzle();
    const across = screen.getByRole('region', { name: 'Across clues' });
    const item = within(across).getByRole('button', { name: /It grows in a pot/ });
    expect(item).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Show answer for this clue' }));
    expect(item).toHaveTextContent('(answer shown)');
  });
});

describe('daily limits', () => {
  const RESETS = new Date('2026-11-21T00:00:00+01:00');
  const playerLimit = new LimitReachedError({
    code: 'player_limit',
    message: "You've made all your new puzzles for today.",
    limit: 10,
    resets_at: RESETS.toISOString(),
    retry_after_seconds: 3600,
  });
  const capacity = new LimitReachedError({
    code: 'daily_capacity',
    message: 'paused',
    limit: 500,
    resets_at: RESETS.toISOString(),
    retry_after_seconds: 3600,
  });

  async function typeThemeAndGenerate(theme: string) {
    fireEvent.change(screen.getByPlaceholderText(/type any theme/i), { target: { value: theme } });
    fireEvent.click(screen.getByRole('button', { name: 'Create puzzle' }));
  }

  it('explains the player limit kindly, keeps the typed theme, and offers today\'s puzzle', async () => {
    generateMock.mockRejectedValueOnce(playerLimit);
    render(<App />);
    await typeThemeAndGenerate('jazz');
    const note = (await screen.findByText("That's all your new themes for today")).closest('.notice')!;
    expect(note).toHaveAttribute('role', 'status');
    expect(note).toHaveTextContent("You've made 10 new puzzles today");
    expect(note).toHaveTextContent(/New themes unlock in/);
    expect(window.alert).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/type any theme/i)).toHaveValue('jazz');

    fireEvent.click(screen.getByRole('button', { name: "Play today's puzzle instead" }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenLastCalledWith(null, 7);
  });

  it('explains when everyone together has used up today\'s new puzzles', async () => {
    generateMock.mockRejectedValueOnce(capacity);
    render(<App />);
    await typeThemeAndGenerate('jazz');
    expect(await screen.findByText('Busy day for puzzles!')).toBeInTheDocument();
  });

  it('the message can be dismissed and disappears on the next try', async () => {
    generateMock.mockRejectedValueOnce(playerLimit);
    render(<App />);
    await typeThemeAndGenerate('jazz');
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns ahead of time when only a few new themes are left', async () => {
    generateMock.mockResolvedValueOnce({
      ...PUZZLE,
      meta: { cached: false, free: false, new_puzzles_left: 2, resets_at: RESETS.toISOString() },
    });
    render(<App />);
    await typeThemeAndGenerate('jazz');
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
    expect(screen.getByText('2 new themes left today')).toBeInTheDocument();
  });

  it('does not nag while plenty of new themes are left', async () => {
    generateMock.mockResolvedValueOnce({
      ...PUZZLE,
      meta: { cached: false, free: false, new_puzzles_left: 8, resets_at: RESETS.toISOString() },
    });
    render(<App />);
    await typeThemeAndGenerate('jazz');
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
    expect(screen.queryByText(/left today/)).not.toBeInTheDocument();
  });

  it('featured themes are labelled as free', () => {
    render(<App />);
    expect(screen.getByText(/free to play/i)).toBeInTheDocument();
  });
});

describe('privacy policy', () => {
  const goTo = (hash: string) =>
    act(() => {
      window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

  afterEach(() => {
    window.location.hash = '';
  });

  it('is linked from the home screen', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '#privacy');
  });

  it('opens at #privacy, says what the app handles, and leads back to the puzzles', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<App />);
    goTo('#privacy');
    const page = screen.getByRole('article');
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(page).toHaveTextContent('Your IP address');
    expect(page).toHaveTextContent('The themes you type');
    expect(page).toHaveTextContent('Anthropic');
    expect(page).toHaveTextContent('Render');
    expect(screen.queryByRole('button', { name: "Play today's puzzle" })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the puzzles/i })).toHaveAttribute('href', '#');

    goTo('');
    expect(screen.getByRole('button', { name: "Play today's puzzle" })).toBeInTheDocument();
  });

  it('can be opened directly from a link', () => {
    window.location.hash = '#privacy';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
  });
});

describe('message helpers', () => {
  const now = new Date('2026-11-20T20:48:00+01:00');
  it.each([
    ['2026-11-21T00:00:00+01:00', 'in 3 h 12 min'],
    ['2026-11-20T23:48:00+01:00', 'in 3 h'],
    ['2026-11-20T21:13:00+01:00', 'in 25 min'],
    ['2026-11-20T20:40:00+01:00', 'in 1 min'],
  ])('time until %s is "%s"', (when, text) => {
    expect(timeUntil(new Date(when), now)).toBe(text);
  });

  it('limit message names the limit and when it resets', () => {
    const n = limitNotice(
      new LimitReachedError({
        code: 'player_limit',
        message: '',
        limit: 10,
        resets_at: '2026-11-21T00:00:00+01:00',
        retry_after_seconds: 1,
      }),
      now
    );
    expect(n.body).toContain("You've made 10 new puzzles today. New themes unlock in 3 h 12 min.");
  });
});

describe("Android's Back button", () => {
  it('on the home screen it is left to the phone (the app is put away)', () => {
    render(<App />);
    expect(androidBack.press!()).toBe(false);
  });

  it('in a puzzle it goes back to the home screen', async () => {
    await startRandomPuzzle();
    let handled = false;
    act(() => {
      handled = androidBack.press!();
    });
    expect(handled).toBe(true);
    expect(screen.getByRole('button', { name: "Play today's puzzle" })).toBeInTheDocument();
  });

  it('on the privacy policy it closes the policy', async () => {
    window.location.hash = '#privacy';
    render(<App />);
    let handled = false;
    act(() => {
      handled = androidBack.press!();
    });
    expect(handled).toBe(true);
    await waitFor(() => expect(window.location.hash).toBe(''));
  });
});

describe('usage statistics', () => {
  it("starting today's puzzle is counted as a daily puzzle", async () => {
    await startRandomPuzzle();
    expect(trackMock).toHaveBeenCalledWith({ name: 'puzzle_started', puzzle_type: 'daily', cached: undefined });
  });

  it('a featured theme is counted with its name', async () => {
    generateMock.mockResolvedValueOnce({
      ...PUZZLE,
      meta: { cached: true, free: true, new_puzzles_left: 10, resets_at: '2026-11-21T00:00:00+01:00' },
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(trackMock).toHaveBeenCalledWith({
      name: 'puzzle_started',
      puzzle_type: 'featured',
      featured_theme: 'History',
      cached: true,
    });
  });

  it('a typed theme is counted as "custom" and its text is never sent', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/type any theme/i), {
      target: { value: 'my grandmother Maria' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create puzzle' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(trackMock).toHaveBeenCalledWith({ name: 'puzzle_started', puzzle_type: 'custom', cached: undefined });
    expect(JSON.stringify(trackMock.mock.calls)).not.toContain('Maria');
  });

  it('finishing is counted once, with the time and the number of reveals', async () => {
    await startRandomPuzzle();
    fireEvent.click(screen.getByRole('button', { name: 'Show answer for this clue' }));
    fillAll(SOLUTION);
    await screen.findByText(/puzzle complete/i);
    const completed = trackMock.mock.calls.filter(([e]) => e.name === 'puzzle_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0][0]).toMatchObject({ puzzle_type: 'daily', reveals: 1 });
    expect(completed[0][0]).toHaveProperty('seconds');
  });

  it('"Reset" is not counted as a new puzzle', async () => {
    await startRandomPuzzle();
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(trackMock.mock.calls.filter(([e]) => e.name === 'puzzle_started')).toHaveLength(1);
  });

  it('reaching the daily limit is counted, and a failed puzzle is not counted as started', async () => {
    generateMock.mockRejectedValueOnce(
      new LimitReachedError({
        code: 'player_limit',
        message: '',
        limit: 10,
        resets_at: '2026-11-21T00:00:00+01:00',
        retry_after_seconds: 60,
      })
    );
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/type any theme/i), { target: { value: 'jazz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create puzzle' }));
    await screen.findByText("That's all your new themes for today");
    expect(trackMock.mock.calls).toEqual([[{ name: 'limit_reached', code: 'player_limit' }]]);
  });

  it('the privacy policy describes the statistics and names the provider', () => {
    window.location.hash = '#privacy';
    render(<App />);
    const page = screen.getByRole('article');
    expect(page).toHaveTextContent('Usage statistics');
    expect(page).toHaveTextContent(/do not include the theme text you type/);
    expect(page).toHaveTextContent('PostHog');
    window.location.hash = '';
  });
});
