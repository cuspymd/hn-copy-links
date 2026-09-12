#!/usr/bin/env node
// Captures the store listing screenshots from a live Hacker News list page
// with the built extension loaded, at the 1280x800 the stores ask for.
//
//   npm run deploy:chrome && node scripts/make-screenshots.mjs
//
// This one needs the network, and the list changes over time, so a
// rerun produces different headlines. That is fine - what the shots have to
// show is the button, the confirmation and the copied mark.

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'store-assets');
const extensionDir = path.join(root, 'dist');

// The 'best' list rather than the front page: its headlines are older and
// calmer, which a store reviewer looks at for longer than we do.
const HN = 'https://news.ycombinator.com/best?h=24';
const BUTTON = '.hncl-button';
const WIDTH = 1280;
const HEIGHT = 800;

if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
  console.error('dist/ is missing. Run "npm run deploy:chrome" first.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--lang=en-US',
  ],
  viewport: { width: WIDTH, height: HEIGHT },
});

await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
  origin: 'https://news.ycombinator.com',
});

function shot(name) {
  return path.join(outDir, name);
}

// The live list is whatever Hacker News is showing, and a store reviewer reads
// every word of a screenshot. Rows whose headline would not survive that are
// dropped from the capture, along with their subtext and spacer rows. Look at
// the results before shipping them: this list is short and the front page is
// not.
const UNSUITABLE = /\b(fuck|shit|cunt|bitch|nazi|porn|nsfw)\b/i;

async function hideUnsuitableRows(page) {
  await page.evaluate((pattern) => {
    const unsuitable = new RegExp(pattern.source, pattern.flags);
    for (const row of document.querySelectorAll('tr.athing')) {
      const title = row.querySelector('.titleline')?.textContent || '';
      if (!unsuitable.test(title)) continue;
      // A submission is three rows: the title, the subtext and a spacer.
      for (const extra of [row.nextElementSibling, row.nextElementSibling?.nextElementSibling]) {
        if (extra) extra.remove();
      }
      row.remove();
    }
  }, { source: UNSUITABLE.source, flags: UNSUITABLE.flags });
}

// 1. The list, with a few rows already copied and one confirmation
// showing, so a single image carries both states of the button.
const page = await context.newPage();
await page.goto(HN, { waitUntil: 'domcontentloaded' });
await page.waitForSelector(BUTTON);
await hideUnsuitableRows(page);

for (const index of [1, 4, 5]) {
  await page.locator(BUTTON).nth(index).click();
  await page.waitForTimeout(1600);
}
await page.locator(BUTTON).nth(2).click();
// The copy is async, so give the confirmation a moment to paint.
await page.waitForTimeout(300);
await page.screenshot({ path: shot('01-front-page.png') });
console.log('Wrote store-assets/01-front-page.png');

// 2. The same page at a larger scale, cropped to the top rows: at 1280x800 the
// button is 13px across, which is too small to read on a store card.
const zoomed = await context.newPage();
await zoomed.setViewportSize({ width: 800, height: 500 });
await zoomed.goto(HN, { waitUntil: 'domcontentloaded' });
await zoomed.waitForSelector(BUTTON);
await hideUnsuitableRows(zoomed);
await zoomed.locator(BUTTON).nth(1).click();
await zoomed.waitForTimeout(1600);
await zoomed.locator(BUTTON).nth(0).click();
await zoomed.waitForTimeout(300);
await zoomed.screenshot({ path: shot('02-buttons-closeup.png'), scale: 'css', clip: { x: 0, y: 0, width: 800, height: 500 } });
// Playwright writes the clip at CSS pixels, so scale it up by rendering the
// same shot again through a page that displays it at 1280x800.
await upscale(shot('02-buttons-closeup.png'), 800, 500);
console.log('Wrote store-assets/02-buttons-closeup.png');

// 3. The phone layout, centred on a 1280x800 canvas so every screenshot in the
// listing keeps the same aspect ratio.
const phone = await context.newPage();
await phone.setViewportSize({ width: 412, height: 780 });
await phone.goto(HN, { waitUntil: 'domcontentloaded' });
await phone.waitForSelector(BUTTON);
await hideUnsuitableRows(phone);
// No confirmation in this one: on a narrow layout the bubble sits over the
// headline above it, which reads as a glitch in a still image. Shot 2 carries
// the confirmation.
for (const index of [1, 4]) {
  await phone.locator(BUTTON).nth(index).click();
  await phone.waitForTimeout(1600);
}
const phoneShot = shot('03-phone.png');
await phone.screenshot({ path: phoneShot });
await frameOnCanvas(phoneShot);
console.log('Wrote store-assets/03-phone.png');

await context.close();

/** Redraws an image at 1280x800 by letting the browser scale it. */
async function upscale(file, width, height) {
  const dataUri = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  const canvas = await context.newPage();
  await canvas.setViewportSize({ width: WIDTH, height: HEIGHT });
  await canvas.setContent(
    `<body style="margin:0;background:#f6f6ef">
       <img src="${dataUri}" style="width:${WIDTH}px;height:${(height / width) * WIDTH}px;display:block;image-rendering:auto">
     </body>`
  );
  await canvas.screenshot({ path: file });
  await canvas.close();
}

/** Centres a phone-shaped screenshot on a 1280x800 canvas. */
async function frameOnCanvas(file) {
  const dataUri = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  const canvas = await context.newPage();
  await canvas.setViewportSize({ width: WIDTH, height: HEIGHT });
  await canvas.setContent(
    `<body style="margin:0;height:${HEIGHT}px;display:flex;align-items:center;justify-content:center;background:#e8e8de">
       <img src="${dataUri}" style="height:${HEIGHT - 40}px;box-shadow:0 2px 18px rgba(0,0,0,.25);border-radius:6px">
     </body>`
  );
  await canvas.screenshot({ path: file });
  await canvas.close();
}
