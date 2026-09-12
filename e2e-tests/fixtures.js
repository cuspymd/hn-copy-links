import { test as base, chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const HN_URL = 'https://news.ycombinator.com/';

// The extension is matched to news.ycombinator.com, so the page under test has
// to carry that URL for the content script to be injected at all. It is served
// from a saved copy of the list markup rather than the live site: the tests
// then need no network, and a redesign breaks them at a time of our choosing.
const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, 'news-list.html'), 'utf8');

export const test = base.extend({
  context: [async ({ }, use) => {
    // The build output is what ships, so that is what the tests load.
    const pathToExtension = path.join(__dirname, '../dist');
    if (!fs.existsSync(path.join(pathToExtension, 'manifest.json'))) {
      throw new Error('dist/ is missing. Run "npm run deploy:chrome" first.');
    }

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        // The extension's strings are localized and these tests assert on the
        // English ones. Without this they follow the machine's own locale.
        '--lang=en-US',
      ],
    });

    // readText is how a test sees what the button actually wrote.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'https://news.ycombinator.com',
    });

    // Routed on the context, not the page, so a test that opens a second tab
    // gets the same fixture without repeating this.
    await context.route(`${HN_URL}**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE_HTML })
    );

    await use(context);
    await context.close();
  }, { timeout: 70_000 }],

  hnPage: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto(HN_URL);
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

// Windows hands text back from the clipboard with CRLF line endings whatever
// was written, so the newlines are normalized here rather than in every
// assertion.
export async function readClipboard(page) {
  const text = await page.evaluate(() => navigator.clipboard.readText());
  return text.replace(/\r\n/g, '\n');
}
