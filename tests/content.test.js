import { loadContentScript, listPage, submissionRow, flushPromises } from './helpers/content-script.js';

const STORAGE_KEY = 'copiedItems';
const SETTINGS_KEY = 'settings';

const ROWS = [
  { id: '41000', title: 'A real post', href: 'https://example.com/a', site: 'example.com', rank: 1 },
  { id: '41001', title: 'Ask HN: how do you read HN?', href: 'item?id=41001', rank: 2 },
];

function buttons() {
  return Array.from(document.querySelectorAll('.hncl-button'));
}

function shareButtons() {
  return Array.from(document.querySelectorAll('.hncl-share'));
}

const ANDROID_UA = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';

// Stand in a browser with a share sheet. The content script decides whether
// it has one when it loads, so call this before loadContentScript.
function withShareSheet({ userAgent = ANDROID_UA, share = jest.fn().mockResolvedValue(undefined) } = {}) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  navigator.share = share;
  return share;
}

function domError(name) {
  const error = new Error(name);
  error.name = name;
  return error;
}

function writeText() {
  return navigator.clipboard.writeText;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
});

afterEach(() => {
  delete navigator.clipboard;
  delete navigator.share;
  delete navigator.userAgent;
});

describe('button injection', () => {
  test('adds one button per submission row, inside the title line', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    expect(buttons()).toHaveLength(2);
    for (const button of buttons()) {
      expect(button.closest('.titleline')).not.toBeNull();
    }
  });

  test('leaves the spacer and subtext rows alone', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    expect(document.querySelectorAll('.subtext .hncl-button')).toHaveLength(0);
  });

  test('does not add a second button when a row is seen twice', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    // The observer fires on any subtree change; re-appending a row is the
    // cheapest way to make it look at one it has already decorated.
    const row = document.getElementById('41000');
    row.parentNode.appendChild(row);
    await flushPromises();

    expect(buttons()).toHaveLength(2);
  });

  test('decorates rows added after load', async () => {
    await loadContentScript({ html: listPage([ROWS[0]]) });
    expect(buttons()).toHaveLength(1);

    const tbody = document.querySelector('tbody');
    tbody.insertAdjacentHTML('beforeend', submissionRow(ROWS[1]));
    await flushPromises();

    expect(buttons()).toHaveLength(2);
  });
});

describe('copying', () => {
  test('writes the two links for an external submission', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();

    expect(writeText()).toHaveBeenCalledWith([
      'Article: https://example.com/a',
      'HN discussion: https://news.ycombinator.com/item?id=41000',
    ].join('\n'));
  });

  test('writes one link for an Ask HN post', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[1].click();
    await flushPromises();

    expect(writeText()).toHaveBeenCalledWith(
      'HN discussion: https://news.ycombinator.com/item?id=41001'
    );
  });

  test('does not follow the title link the button sits inside', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    buttons()[0].dispatchEvent(event);
    await flushPromises();

    expect(event.defaultPrevented).toBe(true);
  });

  test('shows the confirmation, then clears it', async () => {
    await loadContentScript({ html: listPage(ROWS) });
    jest.useFakeTimers();

    try {
      buttons()[0].click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const bubble = document.querySelector('.hncl-bubble');
      expect(bubble.textContent).toBe('copiedFeedback');
      expect(bubble.classList.contains('hncl-bubble-visible')).toBe(true);

      jest.advanceTimersByTime(1500);
      expect(bubble.classList.contains('hncl-bubble-visible')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  // Hacker News clips the title cell with `overflow: hidden`, so a bubble drawn
  // inside the row is invisible on the real site however correct it looks in a
  // fixture. Hanging it off the body is the only part of that a test can check.
  test('puts the confirmation on the body, outside the clipped row', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();

    const bubble = document.querySelector('.hncl-bubble');
    expect(bubble.parentElement).toBe(document.body);
    expect(bubble.closest('tr')).toBeNull();
  });

  test('reuses one bubble across rows', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();
    buttons()[1].click();
    await flushPromises();

    expect(document.querySelectorAll('.hncl-bubble')).toHaveLength(1);
  });

  test('reports a failed copy and does not mark the row', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
    document.execCommand = jest.fn().mockReturnValue(false);

    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();

    expect(document.querySelector('.hncl-bubble').textContent).toBe('copyFailedFeedback');
    expect(buttons()[0].classList.contains('hncl-copied')).toBe(false);
    expect(await chrome.storage.local.get(STORAGE_KEY)).toEqual({});

    delete document.execCommand;
  });
});

describe('copied marks', () => {
  test('marks the button and saves the item after a copy', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();

    expect(buttons()[0].classList.contains('hncl-copied')).toBe(true);
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    expect(Object.keys(stored[STORAGE_KEY])).toEqual(['41000']);
  });

  test('leaves the other rows unmarked', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();

    expect(buttons()[1].classList.contains('hncl-copied')).toBe(false);
  });

  test('restores marks from storage on a later page load', async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: { 41001: Date.now() } });

    await loadContentScript({ html: listPage(ROWS) });

    expect(buttons()[0].classList.contains('hncl-copied')).toBe(false);
    expect(buttons()[1].classList.contains('hncl-copied')).toBe(true);
  });

  test('a second copy of the same row keeps the mark and still writes the text', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();
    buttons()[0].click();
    await flushPromises();

    expect(writeText()).toHaveBeenCalledTimes(2);
    expect(buttons()[0].classList.contains('hncl-copied')).toBe(true);
  });

  test('still draws buttons when the storage read fails', async () => {
    const get = jest.spyOn(chrome.storage.local, 'get').mockRejectedValue(new Error('no storage'));
    try {
      await loadContentScript({ html: listPage(ROWS) });
      expect(buttons()).toHaveLength(2);
    } finally {
      get.mockRestore();
    }
  });
});

describe('accessibility', () => {
  test('the button carries a label that changes with its state', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    expect(buttons()[0].getAttribute('aria-label')).toBe('copyButtonTitle');

    buttons()[0].click();
    await flushPromises();

    expect(buttons()[0].getAttribute('aria-label')).toBe('copiedButtonTitle');
  });

  test('the button is a real button and not a submit', async () => {
    await loadContentScript({ html: listPage(ROWS) });
    expect(buttons()[0].type).toBe('button');
  });
});

describe('the share button', () => {
  test('is on by default on Android, one per row, after the copy button', async () => {
    withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    expect(shareButtons()).toHaveLength(2);
    const titleline = document.getElementById('41000').querySelector('.titleline');
    const ours = Array.from(titleline.querySelectorAll('.hncl-button, .hncl-share'));
    expect(ours.map((el) => el.classList[0])).toEqual(['hncl-button', 'hncl-share']);
  });

  test('is not drawn where there is no share sheet', async () => {
    await loadContentScript({ html: listPage(ROWS) });

    expect(shareButtons()).toHaveLength(0);
    expect(buttons()).toHaveLength(2);
  });

  // Chrome on the desktop has navigator.share, but not the chat apps.
  test('is not drawn off Android, even where the API exists', async () => {
    withShareSheet({ userAgent: DESKTOP_UA });
    await loadContentScript({ html: listPage(ROWS) });

    expect(shareButtons()).toHaveLength(0);
  });

  test('is not drawn when switched off', async () => {
    withShareSheet();
    await chrome.storage.local.set({ [SETTINGS_KEY]: { shareButton: false } });

    await loadContentScript({ html: listPage(ROWS) });

    expect(shareButtons()).toHaveLength(0);
    // The copy button is not part of the bargain.
    expect(buttons()).toHaveLength(2);
  });

  test('shares the text a copy would write', async () => {
    const share = withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    shareButtons()[0].click();
    await flushPromises();

    expect(share).toHaveBeenCalledWith({
      text: [
        'Article: https://example.com/a',
        'HN discussion: https://news.ycombinator.com/item?id=41000',
      ].join('\n'),
    });
    expect(writeText()).not.toHaveBeenCalled();
  });

  // share() needs the click's user activation; anything awaited first spends it.
  test('opens the sheet within the click itself', async () => {
    const share = withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    shareButtons()[0].click();

    expect(share).toHaveBeenCalledTimes(1);
  });

  test('does not follow the title link the button sits inside', async () => {
    withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    shareButtons()[0].dispatchEvent(event);
    await flushPromises();

    expect(event.defaultPrevented).toBe(true);
  });

  test('marks the row once something was shared', async () => {
    withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    shareButtons()[0].click();
    await flushPromises();

    expect(buttons()[0].classList.contains('hncl-copied')).toBe(true);
    expect(buttons()[1].classList.contains('hncl-copied')).toBe(false);
    expect(chrome.storage.local.__store.get(STORAGE_KEY)).toHaveProperty('41000');
  });

  test('a sheet closed without a choice neither marks the row nor complains', async () => {
    withShareSheet({ share: jest.fn().mockRejectedValue(domError('AbortError')) });
    await loadContentScript({ html: listPage(ROWS) });

    shareButtons()[0].click();
    await flushPromises();

    expect(buttons()[0].classList.contains('hncl-copied')).toBe(false);
    expect(await chrome.storage.local.get(STORAGE_KEY)).toEqual({});
    expect(document.querySelector('.hncl-bubble')).toBeNull();
  });

  test('reports a share that failed, and does not mark the row', async () => {
    withShareSheet({ share: jest.fn().mockRejectedValue(domError('NotAllowedError')) });
    await loadContentScript({ html: listPage(ROWS) });

    shareButtons()[0].click();
    await flushPromises();

    expect(document.querySelector('.hncl-bubble').textContent).toBe('shareFailedFeedback');
    expect(buttons()[0].classList.contains('hncl-copied')).toBe(false);
  });

  test('is a real button with a label', async () => {
    withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    expect(shareButtons()[0].getAttribute('aria-label')).toBe('shareButtonTitle');
    expect(shareButtons()[0].type).toBe('button');
  });

  // The settings are changed on a different page, and a reader on a phone
  // should not have to reload the list - and lose their place - to see it take.
  test('appears and disappears when the setting changes elsewhere, once per row', async () => {
    withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    await chrome.storage.local.set({ [SETTINGS_KEY]: { shareButton: false } });
    await flushPromises();
    expect(shareButtons()).toHaveLength(0);

    await chrome.storage.local.set({ [SETTINGS_KEY]: { shareButton: true } });
    await flushPromises();
    expect(shareButtons()).toHaveLength(2);

    await chrome.storage.local.set({ [SETTINGS_KEY]: { shareButton: true } });
    await flushPromises();
    expect(shareButtons()).toHaveLength(2);
  });

  test('a button brought back by the setting still shares its own row', async () => {
    const share = withShareSheet();
    await chrome.storage.local.set({ [SETTINGS_KEY]: { shareButton: false } });
    await loadContentScript({ html: listPage(ROWS) });

    await chrome.storage.local.set({ [SETTINGS_KEY]: { shareButton: true } });
    await flushPromises();
    shareButtons()[1].click();
    await flushPromises();

    expect(share).toHaveBeenCalledWith({ text: 'HN discussion: https://news.ycombinator.com/item?id=41001' });
    expect(buttons()[1].classList.contains('hncl-copied')).toBe(true);
  });

  test('a write to the copied items does not disturb it', async () => {
    withShareSheet();
    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();

    expect(shareButtons()).toHaveLength(2);
  });

  test('rows added later get one too', async () => {
    withShareSheet();
    await loadContentScript({ html: listPage([ROWS[0]]) });

    document.querySelector('tbody').insertAdjacentHTML('beforeend', submissionRow(ROWS[1]));
    await flushPromises();

    expect(shareButtons()).toHaveLength(2);
  });
});
