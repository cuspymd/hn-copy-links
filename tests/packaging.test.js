import fs from 'fs';
import path from 'path';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

const chromeManifest = readJson('manifest.json');
const firefoxManifest = readJson('manifest-firefox.json');

describe('locales', () => {
  const locales = fs.readdirSync(path.join(root, '_locales'));
  const english = readJson('_locales/en/messages.json');

  test('en is the default locale and is present', () => {
    expect(chromeManifest.default_locale).toBe('en');
    expect(locales).toContain('en');
  });

  // A missing key falls back to the default locale silently, so nothing in the
  // browser complains about a translation that was never added.
  test.each(locales)('%s defines the same keys as en', (locale) => {
    const messages = readJson(`_locales/${locale}/messages.json`);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort());
  });

  test.each(locales)('%s has a non-empty message for every key', (locale) => {
    const messages = readJson(`_locales/${locale}/messages.json`);
    for (const [key, entry] of Object.entries(messages)) {
      expect(typeof entry.message).toBe('string');
      expect(entry.message.trim()).not.toBe('');
    }
  });

  test('every __MSG_*__ placeholder in the manifests is defined', () => {
    const used = new Set();
    for (const manifest of [chromeManifest, firefoxManifest]) {
      for (const match of JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) {
        used.add(match[1]);
      }
    }
    for (const key of used) {
      expect(Object.keys(english)).toContain(key);
    }
  });
});

describe('manifests', () => {
  // The two differ only in the Firefox block. Anything else drifting apart is
  // a bug that shows up on one browser only, which is the expensive kind.
  test('differ only by browser_specific_settings', () => {
    const { browser_specific_settings: firefoxOnly, ...firefoxRest } = firefoxManifest;
    expect(firefoxOnly).toBeDefined();
    expect(firefoxRest).toEqual(chromeManifest);
  });

  test('every injected script and stylesheet exists', () => {
    const [contentScript] = chromeManifest.content_scripts;
    for (const file of [...contentScript.js, ...contentScript.css]) {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });

  test('load logger, storage keys and the cores before content.js', () => {
    const { js } = chromeManifest.content_scripts[0];
    const last = js[js.length - 1];
    expect(last).toBe('content-scripts/content.js');
    for (const dependency of [
      'shared/logger.js',
      'shared/browser-api.js',
      'shared/clipboard.js',
      'shared/settings-core.js',
      'constants/storage-keys.js',
      'content-scripts/hn-core.js',
      'content-scripts/copied-store-core.js',
      'content-scripts/share-core.js',
    ]) {
      expect(js.indexOf(dependency)).toBeGreaterThanOrEqual(0);
      expect(js.indexOf(dependency)).toBeLessThan(js.indexOf(last));
    }
  });

  test('ask for storage and Hacker News only', () => {
    expect(chromeManifest.permissions).toEqual(['storage']);
    expect(chromeManifest.host_permissions).toEqual(['https://news.ycombinator.com/*']);
    expect(chromeManifest.content_scripts[0].matches).toEqual(['https://news.ycombinator.com/*']);
  });

  // The settings page is a second surface that has to survive a build: it
  // loads its neighbours by relative path, so a file left out of the copy
  // breaks it and nothing else.
  test('the options page and everything it loads exist', () => {
    const [chromeOptions, firefoxOptions] = [chromeManifest, firefoxManifest].map((m) => m.options_ui);
    expect(chromeOptions).toEqual(firefoxOptions);
    expect(chromeOptions.page).toBe('options/options.html');

    const html = fs.readFileSync(path.join(root, chromeOptions.page), 'utf8');
    const referenced = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const reference of referenced) {
      expect(fs.existsSync(path.resolve(path.dirname(path.join(root, chromeOptions.page)), reference))).toBe(true);
    }
  });

  test('every declared icon exists', () => {
    for (const file of Object.values(chromeManifest.icons)) {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });
});
