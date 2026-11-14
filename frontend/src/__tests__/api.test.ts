/**
 * The call from the app to the backend. `fetch` is faked, so no server is needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCrossword, generateCrossword } from '../api';

const PAYLOAD = {
  grid: [['C', 'A', 'T'], ['#', '#', '#'], ['#', '#', '#']],
  clues: { across: [{ number: 1, clue: 'Feline pet', answer: 'CAT' }], down: [] },
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => PAYLOAD });
  vi.stubGlobal('fetch', fetchMock);
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('generateCrossword', () => {
  it('POSTs the theme and size as JSON to /generate-crossword', async () => {
    const result = await generateCrossword('space', 5);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/generate-crossword$/);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(sentBody()).toEqual({ theme: 'space', size: 5 });
    expect(result).toEqual(PAYLOAD);
  });

  it('defaults to the classic 5x5 mini', async () => {
    await generateCrossword('space');
    expect(sentBody().size).toBe(5);
  });

  it('talks to the local backend when no address is configured', async () => {
    await generateCrossword('space');
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8000/generate-crossword');
  });

  it('talks to the live backend when VITE_API_URL is set', async () => {
    vi.stubEnv('VITE_API_URL', 'https://my-api.example.com/');
    vi.resetModules();
    const live = await import('../api');
    await live.generateCrossword('space');
    expect(fetchMock.mock.calls[0][0]).toBe('https://my-api.example.com/generate-crossword');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([undefined, null, '', '   '])('sends theme %j as "no theme"', async (theme) => {
    await generateCrossword(theme);
    expect(sentBody().theme).toBeNull();
  });

  it('throws a clear error when the backend answers with an error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    await expect(generateCrossword('space')).rejects.toThrow('Backend error: 500');
  });

  it('throws when the backend cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(generateCrossword('space')).rejects.toThrow('Failed to fetch');
  });
});

describe('fetchCrossword', () => {
  it('returns a ready-to-play puzzle labelled with the theme', async () => {
    const cw = await fetchCrossword('pets');
    expect(cw.theme).toBe('pets');
    expect(cw.clues.across[0]).toMatchObject({ answer: 'CAT', number: 1 });
  });

  it('labels a puzzle without a theme as "Random"', async () => {
    const cw = await fetchCrossword();
    expect(cw.theme).toBe('Random');
  });
});
