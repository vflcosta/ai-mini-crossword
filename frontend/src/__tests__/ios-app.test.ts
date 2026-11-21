/**
 * The iPhone and Android apps are the same game packed into an app. These
 * checks catch the setup mistakes that would ship a broken app to a store.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(__dirname, '../..', file), 'utf8');
/** the value of a setting such as `webDir: "build"` in a settings file */
const setting = (file: string, name: string) =>
  read(file).match(new RegExp(`${name}:\\s*["']([^"']+)["']`))?.[1];

describe('iPhone app setup', () => {
  it('the app is built against the live backend, never a local one', () => {
    const address = read('.env.app').match(/^VITE_API_URL=(.+)$/m)?.[1]?.trim();
    expect(address).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(address).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it('the build command always rebuilds the game for the app before packing it', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts['build:ios']).toBe('vite build --mode app && cap sync ios');
    expect(scripts['build:android']).toBe('vite build --mode app && cap sync android');
  });

  it('the tool that reads the app settings file is installed with the project', () => {
    // capacitor.config.ts cannot be read without TypeScript (found on Valentina's Mac)
    expect(JSON.parse(read('package.json')).devDependencies).toHaveProperty('typescript');
  });

  it('the app packs the folder the game is built into', () => {
    expect(setting('capacitor.config.ts', 'webDir')).toBe('build');
    expect(setting('vite.config.ts', 'outDir')).toBe('build');
  });

  it('the app identity matches the Xcode project', () => {
    const appId = setting('capacitor.config.ts', 'appId');
    expect(appId).toMatch(/^[a-z0-9]+(\.[a-z0-9]+)+$/);
    expect(read('ios/App/App.xcodeproj/project.pbxproj')).toContain(
      `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`
    );
  });

  it('the keyboard helper is installed and packed into the app', () => {
    expect(JSON.parse(read('package.json')).dependencies).toHaveProperty('@capacitor/keyboard');
    expect(read('ios/App/CapApp-SPM/Package.swift')).toContain('CapacitorKeyboard');
  });

  it('the page fills the whole iPhone screen and stays clear of the notch', () => {
    expect(read('index.html')).toContain('viewport-fit=cover');
    expect(read('src/index.css')).toContain('env(safe-area-inset-top)');
  });

  it('the app asks Apple no encryption questions and stays upright on iPhone', () => {
    const plist = read('ios/App/App/Info.plist');
    expect(plist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
    const iphone = plist.split('<key>UISupportedInterfaceOrientations</key>')[1].split('</array>')[0];
    expect(iphone).toContain('UIInterfaceOrientationPortrait');
    expect(iphone).not.toContain('Landscape');
  });
});

describe('Android app setup', () => {
  const manifest = () => read('android/app/src/main/AndroidManifest.xml');

  it('the Android keyboard does not suggest words, and still opens', () => {
    // Found by Valentina on the Android test phone: the keyboard showed
    // "S | SO | SHE" above the keys while she filled in an answer.
    const view = read('android/app/src/main/java/com/aiminicrossword/app/CrosswordWebView.java');
    expect(view).toContain('extends CapacitorWebView');
    expect(view).toContain('TYPE_TEXT_VARIATION_VISIBLE_PASSWORD');
    expect(view).toContain('TYPE_TEXT_FLAG_NO_SUGGESTIONS');
    // the app's screen must actually use that class
    const screen = read('android/app/src/main/res/layout/capacitor_bridge_layout_main.xml');
    expect(screen).toContain('<com.aiminicrossword.app.CrosswordWebView');
    expect(screen).toContain('android:id="@+id/webview"');
    // the first attempt (captureInput) removed the suggestions but also the
    // whole keyboard, so it must not come back
    expect(read('capacitor.config.ts')).not.toContain('captureInput');
  });

  it('the app identity matches the Android project', () => {
    const appId = setting('capacitor.config.ts', 'appId');
    expect(read('android/app/build.gradle')).toContain(`applicationId "${appId}"`);
  });

  it('an upright screen is preferred, not required, so the app is not hidden from any device', () => {
    // Found by Google Play when the first closed test was sent for review:
    // "android.hardware.screen.portrait" restricted which devices could install it.
    expect(manifest()).toMatch(
      /<uses-feature\s+android:name="android\.hardware\.screen\.portrait"\s+android:required="false"\s*\/>/,
    );
  });

  it('each upload to Google Play has a new version number', () => {
    // Google refuses a version code it has seen before. Version 1 is already
    // in Play Console (internal test), so the next upload must be higher.
    const gradle = read('android/app/build.gradle');
    const code = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
    expect(code).toBeGreaterThanOrEqual(2);
    expect(gradle).toMatch(/versionName\s+"\d+\.\d+(\.\d+)?"/);
  });

  it('signed builds made on the Mac are never added to the code', () => {
    expect(read('android/.gitignore')).toMatch(/^app\/release\/$/m);
  });

  it('the app stays upright and the page shrinks above the keyboard', () => {
    expect(manifest()).toContain('android:screenOrientation="portrait"');
    expect(manifest()).toContain('android:windowSoftInputMode="adjustResize"');
  });

  it('the name under the icon is short enough to show in full', () => {
    expect(read('android/app/src/main/res/values/strings.xml')).toContain(
      '<string name="app_name">AI Crossword</string>'
    );
  });

  it('the Back button helper is installed and packed into both apps', () => {
    expect(JSON.parse(read('package.json')).dependencies).toHaveProperty('@capacitor/app');
    expect(read('android/capacitor.settings.gradle')).toContain(':capacitor-app');
    expect(read('ios/App/CapApp-SPM/Package.swift')).toContain('CapacitorApp');
  });

  it('the share add-on is installed and packed into both apps', () => {
    expect(JSON.parse(read('package.json')).dependencies).toHaveProperty('@capacitor/share');
    expect(read('android/capacitor.settings.gradle')).toContain(':capacitor-share');
    expect(read('android/app/capacitor.build.gradle')).toContain(':capacitor-share');
    expect(read('ios/App/CapApp-SPM/Package.swift')).toContain('CapacitorShare');
  });

  it('the Google Play signing key can never be added to the code', () => {
    const ignored = read('android/.gitignore');
    expect(ignored).toContain('*.jks');
    expect(ignored).toContain('*.keystore');
  });
});
