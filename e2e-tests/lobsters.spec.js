import { test, expect, readClipboard, LOBSTERS_URL, HN_URL } from './fixtures.js';

const BUTTON = '.hncl-button';

test('puts one button in every Lobsters story title line', async ({ lobstersPage }) => {
  await expect(lobstersPage.locator(BUTTON)).toHaveCount(3);

  const ids = await lobstersPage.locator(BUTTON).evaluateAll((buttons) =>
    buttons.map((button) => button.closest('li.story').dataset.shortid)
  );
  expect(ids).toEqual(['aaa111', 'bbb222', 'ccc333']);
});

test('copies the article and the Lobsters discussion', async ({ lobstersPage }) => {
  await lobstersPage.locator(BUTTON).first().click();

  expect(await readClipboard(lobstersPage)).toBe([
    'Article: https://example.com/holding-up-the-internet',
    'Lobsters discussion: https://lobste.rs/s/aaa111',
  ].join('\n'));
});

test('copies a discussion link for a story with no comments', async ({ lobstersPage }) => {
  await lobstersPage.locator(BUTTON).nth(1).click();

  expect(await readClipboard(lobstersPage)).toContain('Lobsters discussion: https://lobste.rs/s/bbb222');
});

test('copies one link for a Lobsters text post', async ({ lobstersPage }) => {
  await lobstersPage.locator(BUTTON).nth(2).click();

  expect(await readClipboard(lobstersPage)).toBe('Lobsters discussion: https://lobste.rs/s/ccc333');
});

test('keeps the mark after a reload, without marking Hacker News', async ({ context, lobstersPage }) => {
  await lobstersPage.locator(BUTTON).nth(1).click();
  await expect(lobstersPage.locator(BUTTON).nth(1)).toHaveClass(/hncl-copied/);

  await lobstersPage.reload();
  await expect(lobstersPage.locator(BUTTON)).toHaveCount(3);
  await expect(lobstersPage.locator(BUTTON).nth(1)).toHaveClass(/hncl-copied/);
  await expect(lobstersPage.locator(BUTTON).nth(0)).not.toHaveClass(/hncl-copied/);
  expect(lobstersPage.url()).toBe(LOBSTERS_URL);

  const hn = await context.newPage();
  await hn.goto(HN_URL);
  await expect(hn.locator(BUTTON)).toHaveCount(3);
  await expect(hn.locator(`${BUTTON}.hncl-copied`)).toHaveCount(0);
  await hn.close();
});

test('shows the confirmation above the button', async ({ lobstersPage }) => {
  const button = lobstersPage.locator(BUTTON).first();
  const bubble = lobstersPage.locator('.hncl-bubble');

  await button.click();

  await expect(bubble).toHaveText('Copied');
  const bubbleBox = await bubble.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(bubbleBox.y + bubbleBox.height).toBeLessThanOrEqual(buttonBox.y + 1);
});

// The stylesheet borrows the site's own palette, which is how the buttons
// follow Lobsters into its dark theme.
test('wears the Lobsters palette', async ({ lobstersPage }) => {
  const button = lobstersPage.locator(BUTTON).first();
  await expect(button).toHaveCSS('color', 'rgb(122, 122, 122)');

  await button.hover();
  await expect(button).toHaveCSS('color', 'rgb(172, 19, 13)');
});

test('leaves no focus box around a clicked button', async ({ lobstersPage }) => {
  const button = lobstersPage.locator(BUTTON).first();
  await button.click();
  await expect(button).toHaveCSS('outline-style', 'none');
});

test('draws no share button on the desktop', async ({ lobstersPage }) => {
  await expect(lobstersPage.locator(BUTTON)).toHaveCount(3);
  await expect(lobstersPage.locator('.hncl-share')).toHaveCount(0);
});
