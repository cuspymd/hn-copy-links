// Puts a copy button on every Hacker News submission row and keeps the
// "already copied" marks in sync with extension local storage.
(function () {
  const { parseRow, buildCopyText } = window.HnCore;
  const { markCopied, isCopied } = window.CopiedStoreCore;
  const browserAPI = window.browserAPI;
  const COPIED_ITEMS_KEY = window.STORAGE_KEYS.COPIED_ITEMS;

  const BUTTON_CLASS = 'hncl-button';
  const COPIED_CLASS = 'hncl-copied';
  const BUBBLE_CLASS = 'hncl-bubble';
  const VISIBLE_CLASS = 'hncl-bubble-visible';
  const FEEDBACK_MS = 1500;

  // Two glyphs rather than two states of one: the copied mark has to be
  // readable at a glance down a list of thirty rows, and a colour change alone
  // is not (and is invisible to a colour-blind reader).
  const COPY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
    + '<rect x="5.5" y="2.5" width="8" height="10" rx="1.5" />'
    + '<path d="M10.5 13.5v0a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 4 3.5h0" />'
    + '</svg>';
  const COPIED_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
    + '<path d="M2.5 8.5l4 4 7-8" />'
    + '</svg>';

  function message(name) {
    return browserAPI.i18n?.getMessage(name) || name;
  }

  let copiedItems = {};

  async function loadCopiedItems() {
    try {
      const stored = await browserAPI.storage.local.get(COPIED_ITEMS_KEY);
      copiedItems = stored?.[COPIED_ITEMS_KEY] || {};
    } catch (error) {
      // A read failure only costs the marks, so carry on with an empty map
      // rather than leaving the page without buttons.
      window.errorLog('Failed to read copied items', error);
      copiedItems = {};
    }
  }

  async function persistCopiedItems() {
    try {
      await browserAPI.storage.local.set({ [COPIED_ITEMS_KEY]: copiedItems });
    } catch (error) {
      window.errorLog('Failed to save copied items', error);
    }
  }

  function applyCopiedState(button, copied) {
    button.classList.toggle(COPIED_CLASS, copied);
    button.innerHTML = copied ? COPIED_ICON : COPY_ICON;
    button.title = message(copied ? 'copiedButtonTitle' : 'copyButtonTitle');
    button.setAttribute('aria-label', button.title);
  }

  // The confirmation hangs off the body, not off the button, and is positioned
  // from the button's own rectangle. Hacker News puts `overflow: hidden` on the
  // title cell, so anything drawn inside the row is clipped away the moment it
  // reaches above the line - which is where a bubble has to go.
  let bubble = null;
  let bubbleTimer = null;

  function showFeedback(button, text) {
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = BUBBLE_CLASS;
      document.body.appendChild(bubble);
    }

    const rect = button.getBoundingClientRect();
    bubble.textContent = text;
    bubble.style.left = `${rect.left + rect.width / 2}px`;
    bubble.style.top = `${rect.top}px`;
    bubble.classList.add(VISIBLE_CLASS);

    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove(VISIBLE_CLASS), FEEDBACK_MS);
  }

  async function handleClick(event, button, item) {
    // The button sits inside the title line, which is a link on Hacker News.
    event.preventDefault();
    event.stopPropagation();

    const copied = await window.copyTextToClipboard(buildCopyText(item));
    if (!copied) {
      showFeedback(button, message('copyFailedFeedback'));
      return;
    }

    showFeedback(button, message('copiedFeedback'));
    applyCopiedState(button, true);
    copiedItems = markCopied(copiedItems, item.itemId);
    await persistCopiedItems();
  }

  function addButton(row) {
    if (row.dataset.hnclDecorated) return;

    // baseURI rather than location.href: it is what the browser itself
    // resolves the title link against.
    const item = parseRow(row, document.baseURI);
    if (!item) return;

    const titleline = row.querySelector('.titleline');
    if (!titleline) return;

    row.dataset.hnclDecorated = 'true';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    applyCopiedState(button, isCopied(copiedItems, item.itemId));
    button.addEventListener('click', (event) => handleClick(event, button, item));

    titleline.appendChild(button);
  }

  function decorateAll(root = document) {
    root.querySelectorAll('tr.athing').forEach(addButton);
  }

  // Hacker News renders on the server, so one pass covers every page. The
  // observer is a safety net for rows added by another extension or by a
  // future in-page "more" control; rows already carrying the marker are skipped.
  let observer = null;

  function watchForNewRows() {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.('tr.athing')) addButton(node);
          else decorateAll(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Injected twice on one page - by the manifest and again by hand, or by a
  // reload that does not tear the page down - the first instance's observer
  // would keep running and decorate rows from its own stale map. Stand it down.
  window.hnCopyLinks?.dispose();

  async function init() {
    await loadCopiedItems();
    decorateAll();
    watchForNewRows();
  }

  window.hnCopyLinks = {
    dispose() {
      observer?.disconnect();
      observer = null;
      clearTimeout(bubbleTimer);
      bubble?.remove();
      bubble = null;
    },
  };

  init();
})();
