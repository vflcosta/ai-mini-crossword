import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Settings for the phone app (the same game, wrapped as an iPhone app).
 * See the "iPhone app" section of the README for how to build it.
 *
 * appId is the app's permanent identity in the App Store. It can be changed
 * freely until the first upload to Apple; after that it is fixed forever.
 */
const config: CapacitorConfig = {
  appId: "com.aiminicrossword.app",
  appName: "AI Mini Crossword",
  webDir: "build", // where `npm run build` puts the finished game
  backgroundColor: "#f5f3ff", // the app's lavender, shown while the game loads
};

export default config;
