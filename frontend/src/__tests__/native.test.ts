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
const appMock = vi.hoisted(() => ({
  addListener: vi.fn(),
  minimizeApp: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: appMock.addListener,
    minimizeApp: appMock.minimizeApp,
  },
}));

const shareMock = vi.hoisted(() => ({ share: vi.fn(async () => ({})) }));
vi.mock('@capacitor/share', () => ({ Share: shareMock }));

import { onAndroidBack, setupNativeApp, shareResult } from '../native';

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

describe('Android Back button', () => {
  // the function Android calls when Back is pressed
  let pressBack: () => void;
  beforeEach(() => {
    appMock.addListener.mockReset().mockImplementation(async (_name: string, fn: () => void) => {
      pressBack = fn;
      return { remove: appMock.remove };
    });
    appMock.minimizeApp.mockReset();
    appMock.remove.mockReset();
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('the website and the iPhone app do not listen for it', async () => {
    for (const platform of ['web', 'ios']) {
      platformMock.getPlatform.mockReturnValue(platform);
      onAndroidBack(() => true);
    }
    await settle();
    expect(appMock.addListener).not.toHaveBeenCalled();
  });

  it('when the game handles Back, the app stays open', async () => {
    platformMock.getPlatform.mockReturnValue('android');
    onAndroidBack(() => true);
    await settle();
    pressBack();
    expect(appMock.minimizeApp).not.toHaveBeenCalled();
  });

  it('on the home screen, Back puts the app away', async () => {
    platformMock.getPlatform.mockReturnValue('android');
    onAndroidBack(() => false);
    await settle();
    pressBack();
    expect(appMock.minimizeApp).toHaveBeenCalled();
  });

  it('stops listening when asked, even before the listener is ready', async () => {
    platformMock.getPlatform.mockReturnValue('android');
    const stop = onAndroidBack(() => true);
    stop();
    await settle();
    expect(appMock.remove).toHaveBeenCalled();
  });
});

describe('sharing a result', () => {
  const setShare = (value: unknown) =>
    Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true });
  const setClipboard = (writeText: unknown) =>
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

  beforeEach(() => {
    shareMock.share.mockReset().mockResolvedValue({});
    setShare(undefined);
    setClipboard(vi.fn().mockResolvedValue(undefined));
  });

  it("the iPhone and Android apps open the phone's own share menu", async () => {
    for (const platform of ['ios', 'android']) {
      platformMock.getPlatform.mockReturnValue(platform);
      expect(await shareResult('I solved it!')).toBe('shared');
    }
    expect(shareMock.share).toHaveBeenCalledTimes(2);
    expect(shareMock.share).toHaveBeenCalledWith({ text: 'I solved it!', dialogTitle: 'Share your result' });
  });

  it('in the apps, closing the share menu is not an error and copies nothing', async () => {
    platformMock.getPlatform.mockReturnValue('android');
    shareMock.share.mockRejectedValue(new Error('Share canceled'));
    const writeText = vi.fn();
    setClipboard(writeText);
    expect(await shareResult('I solved it!')).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('in the apps, if the share menu cannot open, the text is copied instead', async () => {
    platformMock.getPlatform.mockReturnValue('ios');
    shareMock.share.mockRejectedValue(new Error('Not available'));
    expect(await shareResult('I solved it!')).toBe('copied');
  });

  it("the website uses the browser's share menu where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    expect(await shareResult('I solved it!')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'I solved it!' });
    expect(shareMock.share).not.toHaveBeenCalled();
  });

  it('the website copies the text when the browser has no share menu', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    expect(await shareResult('I solved it!')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('I solved it!');
  });

  it('says so when neither sharing nor copying works', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('blocked')));
    expect(await shareResult('I solved it!')).toBe('failed');
  });
});
