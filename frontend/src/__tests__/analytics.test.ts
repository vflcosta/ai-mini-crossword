/**
 * Usage statistics: what is sent, and above all what is never sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthogMock = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock('posthog-js', () => ({ default: posthogMock }));

import { describePuzzle, initAnalytics, track } from '../analytics';

beforeEach(async () => {
  posthogMock.init.mockReset();
  posthogMock.capture.mockReset();
  await initAnalytics({ enabled: false });
});

describe('when statistics are collected', () => {
  it('nothing is sent during development or in tests', async () => {
    expect(await initAnalytics()).toBe(false);
    track({ name: 'limit_reached', code: 'player_limit' });
    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('nothing is sent when no project key is configured', async () => {
    expect(await initAnalytics({ enabled: true, key: '' })).toBe(false);
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it('on the live site it starts with the privacy settings the policy promises', async () => {
    expect(await initAnalytics({ enabled: true, key: 'phc_test' })).toBe(true);
    const [key, config] = posthogMock.init.mock.calls[0];
    expect(key).toBe('phc_test');
    expect(config).toMatchObject({
      api_host: 'https://eu.i.posthog.com', // EU data region
      cookieless_mode: 'always', // no cookies or browser storage
      autocapture: false, // no recording of every click
      capture_heatmaps: false,
      disable_session_recording: true,
      capture_pageview: true, // visitors are counted
    });
  });
});

describe('events', () => {
  beforeEach(async () => {
    await initAnalytics({ enabled: true, key: 'phc_test' });
  });

  it('sends the event name with its details', () => {
    track({ name: 'puzzle_completed', puzzle_type: 'daily', seconds: 95, reveals: 2 });
    expect(posthogMock.capture).toHaveBeenCalledWith('puzzle_completed', {
      puzzle_type: 'daily',
      seconds: 95,
      reveals: 2,
    });
  });

  it('a failure in the statistics tool never breaks the game', () => {
    posthogMock.capture.mockImplementation(() => {
      throw new Error('blocked by an ad blocker');
    });
    expect(() => track({ name: 'limit_reached', code: 'daily_capacity' })).not.toThrow();
  });
});

describe('loading in the background', () => {
  it('events that happen before the library is ready are sent once it is', async () => {
    const starting = initAnalytics({ enabled: true, key: 'phc_test' });
    track({ name: 'puzzle_started', puzzle_type: 'daily' }); // library not loaded yet
    expect(posthogMock.capture).not.toHaveBeenCalled();
    await starting;
    expect(posthogMock.capture).toHaveBeenCalledWith('puzzle_started', { puzzle_type: 'daily' });
  });

  it('the game works without statistics when the library cannot start', async () => {
    posthogMock.init.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(await initAnalytics({ enabled: true, key: 'phc_test' })).toBe(false);
    expect(() => track({ name: 'limit_reached', code: 'player_limit' })).not.toThrow();
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });
});

describe('describing a puzzle without revealing typed text', () => {
  it("no theme is today's puzzle", () => {
    expect(describePuzzle('')).toEqual({ puzzle_type: 'daily' });
    expect(describePuzzle('   ')).toEqual({ puzzle_type: 'daily' });
  });

  it('a featured theme is named, in any spelling', () => {
    expect(describePuzzle(' history ')).toEqual({ puzzle_type: 'featured', featured_theme: 'History' });
  });

  it('a typed theme is only reported as "custom"', () => {
    const described = describePuzzle('my grandmother Maria');
    expect(described).toEqual({ puzzle_type: 'custom' });
    expect(JSON.stringify(described)).not.toContain('Maria');
  });
});
