import { test, expect, readClipboard, HN_URL } from './fixtures.js';

const BUTTON = '.hncl-button';

test('puts one button in every submission title line', async ({ hnPage }) => {
  await expect(hnPage.locator(BUTTON)).toHaveCount(3);

  const rowIds = await hnPage.locator(BUTTON).evaluateAll((buttons) =>
    buttons.map((button) => button.closest('tr').id)
  );
  expect(rowIds).toEqual(['41000001', '41000002', '41000003']);
});

test('copies the article and the discussion', async ({ hnPage }) => {
  await hnPage.locator(BUTTON).first().click();

  expect(await readClipboard(hnPage)).toBe([
    'Article: https://example.com/rust-in-the-kernel',
    'HN discussion: https://news.ycombinator.com/item?id=41000001',
  ].join('\n'));
});

test('copies a discussion link even when the row says "discuss"', async ({ hnPage }) => {
  // The comment count anchor reads "discuss" with no comments yet, which is why
  // the link is built from the row id instead.
  await hnPage.locator(BUTTON).nth(1).click();

  expect(await readClipboard(hnPage)).toContain(
    'HN discussion: https://news.ycombinator.com/item?id=41000002'
  );
});

test('copies one link for a text post', async ({ hnPage }) => {
  await hnPage.locator(BUTTON).nth(2).click();

  expect(await readClipboard(hnPage)).toBe(
    'HN discussion: https://news.ycombinator.com/item?id=41000003'
  );
});

test('does not navigate when the button is clicked', async ({ hnPage }) => {
  await hnPage.locator(BUTTON).first().click();
  expect(hnPage.url()).toBe(HN_URL);
});

test('marks the clicked row and leaves the others alone', async ({ hnPage }) => {
  await hnPage.locator(BUTTON).nth(1).click();

  await expect(hnPage.locator(BUTTON).nth(1)).toHaveClass(/hncl-copied/);
  await expect(hnPage.locator(BUTTON).nth(0)).not.toHaveClass(/hncl-copied/);
  await expect(hnPage.locator(BUTTON).nth(2)).not.toHaveClass(/hncl-copied/);
});

test('keeps the mark after a reload', async ({ hnPage }) => {
  await hnPage.locator(BUTTON).nth(1).click();
  await expect(hnPage.locator(BUTTON).nth(1)).toHaveClass(/hncl-copied/);

  await hnPage.reload();

  await expect(hnPage.locator(BUTTON)).toHaveCount(3);
  await expect(hnPage.locator(BUTTON).nth(1)).toHaveClass(/hncl-copied/);
  await expect(hnPage.locator(BUTTON).nth(0)).not.toHaveClass(/hncl-copied/);
});

test('keeps the mark in a new tab on the same profile', async ({ context, hnPage }) => {
  await hnPage.locator(BUTTON).first().click();
  await expect(hnPage.locator(BUTTON).first()).toHaveClass(/hncl-copied/);

  const second = await context.newPage();
  await second.goto(HN_URL);

  await expect(second.locator(BUTTON).first()).toHaveClass(/hncl-copied/);
  await second.close();
});

test('shows a short confirmation after a copy', async ({ hnPage }) => {
  const button = hnPage.locator(BUTTON).first();
  const bubble = hnPage.locator('.hncl-bubble');

  await button.click();

  await expect(bubble).toHaveText('Copied');
  await expect(bubble).toBeVisible();

  // Hacker News clips the title cell, so the bubble has to sit above the row
  // and outside it. Both halves of that are checked here.
  const bubbleBox = await bubble.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(bubbleBox.y + bubbleBox.height).toBeLessThanOrEqual(buttonBox.y + 1);
  expect(await bubble.evaluate((el) => el.parentElement === document.body)).toBe(true);

  await expect(bubble).toBeHidden({ timeout: 4000 });
});

// The share button is for Android's share sheet, and this is desktop
// Chromium - which has navigator.share, but not the chat apps in its sheet.
// What it does on a phone is covered by the unit suite and by hand.
test('draws no share button on the desktop', async ({ hnPage }) => {
  await expect(hnPage.locator(BUTTON)).toHaveCount(3);
  await expect(hnPage.locator('.hncl-share')).toHaveCount(0);
});
