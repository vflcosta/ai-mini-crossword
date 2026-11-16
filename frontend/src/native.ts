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
