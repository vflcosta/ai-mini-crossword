/**
 * The iPhone app is the same game packed into an app. These checks catch the
 * setup mistakes that would ship a broken app to the App Store.
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
    const address = read('.env.ios').match(/^VITE_API_URL=(.+)$/m)?.[1]?.trim();
    expect(address).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(address).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it('the build command always rebuilds the game for the app before packing it', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts['build:ios']).toBe('vite build --mode ios && cap sync ios');
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
