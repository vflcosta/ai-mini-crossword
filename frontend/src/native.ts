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
