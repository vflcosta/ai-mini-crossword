/**
 * The call from the app to the backend. `fetch` is faked, so no server is needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCrossword, fetchFeaturedAngles, generateCrossword, LimitReachedError } from '../api';

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

  it('defaults to the game\'s 7x7 grid', async () => {
    await generateCrossword('space');
    expect(sentBody().size).toBe(7);
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

  it('turns a "limit reached" answer into a LimitReachedError with the details', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        detail: {
          code: 'player_limit',
          message: "You've made all your new puzzles for today.",
          limit: 10,
          resets_at: '2026-11-21T00:00:00+01:00',
          retry_after_seconds: 3600,
        },
      }),
    });
    const err = await generateCrossword('jazz').catch((e) => e);
    expect(err).toBeInstanceOf(LimitReachedError);
    expect(err.code).toBe('player_limit');
    expect(err.limit).toBe(10);
    expect(err.resetsAt.toISOString()).toBe('2026-11-20T23:00:00.000Z');
  });

  it('a 429 without details is still reported as an error', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 429, statusText: 'Too Many Requests', json: async () => { throw new Error('not json'); },
    });
    const err = await generateCrossword('jazz').catch((e) => e);
    expect(err).not.toBeInstanceOf(LimitReachedError);
    expect(err.message).toContain('429');
  });

  it('passes on the extra puzzle information from the backend', async () => {
    const meta = { cached: true, free: false, new_puzzles_left: 4, resets_at: '2026-11-21T00:00:00+01:00' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...PAYLOAD, meta }) });
    expect((await generateCrossword('jazz')).meta).toEqual(meta);
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

describe('fetchFeaturedAngles', () => {
  it("asks GET /featured and returns today's angle for each theme", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '2026-11-21',
        themes: [
          { theme: 'History', angle: 'Samurai Japan' },
          { theme: 'Music', angle: 'Musicals' },
        ],
      }),
    });
    expect(await fetchFeaturedAngles()).toEqual({ History: 'Samurai Japan', Music: 'Musicals' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8000/featured');
  });

  it('returns nothing (instead of failing) when the backend answers with an error', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchFeaturedAngles()).toEqual({});
  });

  it('returns nothing when the backend cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchFeaturedAngles()).toEqual({});
  });
});
