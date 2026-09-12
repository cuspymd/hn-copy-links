import { loadContentScript, listPage, submissionRow, flushPromises } from './helpers/content-script.js';

const STORAGE_KEY = 'copiedItems';

const ROWS = [
  { id: '41000', title: 'A real post', href: 'https://example.com/a', site: 'example.com', rank: 1 },
  { id: '41001', title: 'Ask HN: how do you read HN?', href: 'item?id=41001', rank: 2 },
];

function buttons() {
  return Array.from(document.querySelectorAll('.hncl-button'));
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

      const button = buttons()[0];
      expect(button.classList.contains('hncl-feedback')).toBe(true);
      expect(button.dataset.hnclFeedback).toBe('copiedFeedback');

      jest.advanceTimersByTime(1500);
      expect(button.classList.contains('hncl-feedback')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('reports a failed copy and does not mark the row', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
    document.execCommand = jest.fn().mockReturnValue(false);

    await loadContentScript({ html: listPage(ROWS) });

    buttons()[0].click();
    await flushPromises();

    expect(buttons()[0].dataset.hnclFeedback).toBe('copyFailedFeedback');
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
