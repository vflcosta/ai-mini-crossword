/**
 * Playing the game, the way a real user would: click, type, solve.
 * The backend is faked, so these tests need no server and no AI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App, { limitNotice, puzzleDateLabel, timeUntil } from '../App';
import { generateCrossword, LimitReachedError } from '../api';
import type { BackendPayload } from '../types/api';

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  generateCrossword: vi.fn(),
}));
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
  fireEvent.click(screen.getByRole('button', { name: "Play today's puzzle" }));
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

  it('"Play today\'s puzzle" asks for a 5x5 puzzle with no theme and opens the game', async () => {
    await startRandomPuzzle();
    expect(generateMock).toHaveBeenCalledWith(null, 5);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('"Create puzzle" sends the typed theme, without extra spaces', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/type any theme/i), {
      target: { value: '  space  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create puzzle' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenCalledWith('space', 5);
  });

  it('shows a loading screen with a skeleton grid while the puzzle is being made', async () => {
    let finish!: (p: BackendPayload) => void;
    generateMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    const loader = await screen.findByRole('status');
    expect(loader).toHaveTextContent('Creating your History crossword…');
    expect(loader).toHaveTextContent('This can take up to 1 minute');
    expect(document.querySelectorAll('.skeleton-cell')).toHaveLength(25);
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
    await waitFor(() => expect(generateMock).toHaveBeenCalledWith('jazz', 5));
  });

  it('tapping a theme chip like "History" generates a History puzzle', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    await waitFor(() => expect(squares()).toHaveLength(SOLUTION.length));
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(generateMock).toHaveBeenCalledWith('History', 5);
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
    expect(screen.getByRole('button', { name: "Play today's puzzle" })).toBeInTheDocument();
    expect(squares()).toHaveLength(0);
  });

  it('"Reset" starts the same puzzle again without asking for a new one', async () => {
    await startRandomPuzzle();
    type(SQUARE.P, 'P');
    click(SQUARE.P);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(squares()[SQUARE.P]).toHaveValue('');
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('Select a clue')).toBeInTheDocument();
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it('the celebration says when the puzzle was solved without reveals', async () => {
    await startRandomPuzzle();
    fillAll(SOLUTION);
    expect(await screen.findByText(/no reveals/i)).toBeInTheDocument();
  });

  it('the celebration counts how many answers were revealed', async () => {
    await startRandomPuzzle();
    click(SQUARE.P);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    click(SQUARE.R_of_TREE);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    fillAll(SOLUTION);
    expect(await screen.findByText('💡 2 answers revealed')).toBeInTheDocument();
  });

  it('revealing the same answer twice counts once', async () => {
    await startRandomPuzzle();
    click(SQUARE.P);
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    click(SQUARE.A);
    fillAll(SOLUTION);
    expect(await screen.findByText('💡 1 answer revealed')).toBeInTheDocument();
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
    expect(generateMock).toHaveBeenLastCalledWith(null, 5);
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
    expect(screen.getByText(/featured themes are free/i)).toBeInTheDocument();
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

describe('look and feel', () => {
  it('the square being filled in and the rest of its word are highlighted', async () => {
    await startRandomPuzzle();
    click(SQUARE.A); // PLANT across
    const cell = (i: number) => squares()[i].parentElement as HTMLElement;
    expect(cell(SQUARE.A).style.background).toBe('rgb(196, 181, 253)'); // selected
    expect(cell(SQUARE.P).style.background).toBe('rgb(237, 233, 254)'); // same word
    expect(cell(SQUARE.E_of_LEAF).style.background).toBe('rgb(255, 255, 255)'); // other word

    click(SQUARE.L);
    click(SQUARE.L); // LEAF down
    expect(cell(SQUARE.E_of_LEAF).style.background).toBe('rgb(237, 233, 254)');
    expect(cell(SQUARE.P).style.background).toBe('rgb(255, 255, 255)');
  });

  it('featured theme buttons keep their plain names for screen readers', () => {
    render(<App />);
    for (const name of ['History', 'Space', 'Art', 'Nature', 'Science']) {
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

  it('phones do not get the clue lists', async () => {
    await startRandomPuzzle();
    expect(screen.queryByRole('region', { name: 'Across clues' })).not.toBeInTheDocument();
  });

  it('wide screens list every clue next to the grid', async () => {
    asDesktop();
    await startRandomPuzzle();
    const across = screen.getByRole('region', { name: 'Across clues' });
    const down = screen.getByRole('region', { name: 'Down clues' });
    expect(across).toHaveTextContent('It grows in a pot');
    expect(down).toHaveTextContent('It falls in autumn');
    expect(down).toHaveTextContent('It has a trunk');
    expect(document.querySelectorAll('.clue-list-item')).toHaveLength(3);
  });

  it('clicking a clue in the list jumps to it in the grid', async () => {
    asDesktop();
    await startRandomPuzzle();
    const item = screen.getByRole('button', { name: /It has a trunk/ });
    fireEvent.click(item);
    expect(item).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText(/Down • 4 letters/)).toBeInTheDocument();
    // typing now fills TREE downwards from its first square
    type(SQUARE.T, 'T');
    expect(squares()[SQUARE.R_of_TREE]).toHaveFocus();
  });

  it('the list follows the square selected in the grid and marks revealed clues', async () => {
    asDesktop();
    await startRandomPuzzle();
    click(SQUARE.P);
    const item = screen.getByRole('button', { name: /It grows in a pot/ });
    expect(item).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    expect(item).toHaveTextContent('(revealed)');
  });
});
