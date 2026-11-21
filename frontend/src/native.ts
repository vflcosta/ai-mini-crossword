/**
 * Things that only apply inside the phone app (not on the website).
 */
import { Capacitor } from "@capacitor/core";

/**
 * iPhone shows its own strip above the keyboard with up / down arrows and a
 * tick. In the game those arrows do nothing useful, so the app hides the
 * strip; the game's own clue bar (with working arrows) sits there instead.
 */
export async function setupNativeApp(): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") return;
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
    // lets the styles know when the keyboard is on screen
    await Keyboard.addListener("keyboardWillShow", () =>
      document.body.classList.add("keyboard-open")
    );
    await Keyboard.addListener("keyboardWillHide", () =>
      document.body.classList.remove("keyboard-open")
    );
  } catch {
    // the game works without this; the strip simply stays visible
  }
}

/**
 * Android phones have a Back button (or a back swipe). In the app it should
 * behave like the game's own "Back" links: close the privacy policy, leave a
 * puzzle for the home screen, and only on the home screen put the app away.
 * `handleBack` returns true when the game handled the press itself.
 * Does nothing on the website or on iPhone. Returns a function that stops listening.
 */
export function onAndroidBack(handleBack: () => boolean): () => void {
  if (Capacitor.getPlatform() !== "android") return () => {};
  let stop: (() => void) | undefined;
  let stopped = false;
  import("@capacitor/app")
    .then(({ App }) =>
      App.addListener("backButton", () => {
        if (!handleBack()) App.minimizeApp();
      })
    )
    .then((listener) => {
      stop = () => listener.remove();
      if (stopped) stop();
    })
    .catch(() => {
      // the game works without this; Back then simply leaves the app
    });
  return () => {
    stopped = true;
    stop?.();
  };
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

const isCancel = (err: unknown) =>
  (err instanceof Error && (err.name === "AbortError" || /cancel/i.test(err.message))) ||
  /cancel/i.test(String(err));

/**
 * Shares the player's result through the phone's own share menu.
 * - iPhone and Android apps: Capacitor's share add-on (their in-app web view
 *   has no reliable share menu of its own).
 * - Website: the browser's share menu where there is one, otherwise the text
 *   is copied so the player can paste it.
 * Closing the share menu without sharing is "cancelled", not a failure.
 */
export async function shareResult(text: string): Promise<ShareOutcome> {
  if (Capacitor.getPlatform() !== "web") {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ text, dialogTitle: "Share your result" });
      return "shared";
    } catch (err) {
      if (isCancel(err)) return "cancelled";
      // fall through to copying the text
    }
  } else if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if (isCancel(err)) return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
