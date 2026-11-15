/**
 * Things that only happen inside the iPhone app.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformMock = vi.hoisted(() => ({ getPlatform: vi.fn(() => 'web') }));
vi.mock('@capacitor/core', () => ({ Capacitor: platformMock }));
const keyboardMock = vi.hoisted(() => ({
  setAccessoryBarVisible: vi.fn(async () => {}),
  addListener: vi.fn(async () => ({ remove: () => {} })),
}));
vi.mock('@capacitor/keyboard', () => ({ Keyboard: keyboardMock }));

import { setupNativeApp } from '../native';

beforeEach(() => {
  platformMock.getPlatform.mockReturnValue('web');
  keyboardMock.setAccessoryBarVisible.mockReset().mockResolvedValue(undefined);
  keyboardMock.addListener.mockClear();
  document.body.classList.remove('keyboard-open');
});

describe('iPhone keyboard', () => {
  it('the website leaves the keyboard alone', async () => {
    await setupNativeApp();
    expect(keyboardMock.setAccessoryBarVisible).not.toHaveBeenCalled();
  });

  it("the iPhone app hides the phone's own strip of arrows above the keyboard", async () => {
    platformMock.getPlatform.mockReturnValue('ios');
    await setupNativeApp();
    expect(keyboardMock.setAccessoryBarVisible).toHaveBeenCalledWith({ isVisible: false });
  });

  it('the app notes when the keyboard opens and closes', async () => {
    platformMock.getPlatform.mockReturnValue('ios');
    await setupNativeApp();
    const listeners = Object.fromEntries(
      keyboardMock.addListener.mock.calls.map(([name, fn]: any[]) => [name, fn])
    );
    listeners.keyboardWillShow();
    expect(document.body).toHaveClass('keyboard-open');
    listeners.keyboardWillHide();
    expect(document.body).not.toHaveClass('keyboard-open');
  });

  it('the game still starts if the keyboard cannot be adjusted', async () => {
    platformMock.getPlatform.mockReturnValue('ios');
    keyboardMock.setAccessoryBarVisible.mockRejectedValue(new Error('not available'));
    await expect(setupNativeApp()).resolves.toBeUndefined();
  });
});
