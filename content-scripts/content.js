// Puts a copy button - and, on Android, a share button - on every Hacker News
// submission row, and keeps the "already copied" marks in sync with extension
// local storage.
(function () {
  const { parseRow, buildCopyText } = window.HnCore;
  const { markCopied, isCopied } = window.CopiedStoreCore;
  const { normalizeSettings } = window.SettingsCore;
  const { isShareSheetAvailable, shareText } = window.ShareCore;
  const browserAPI = window.browserAPI;
  const COPIED_ITEMS_KEY = window.STORAGE_KEYS.COPIED_ITEMS;
  const SETTINGS_KEY = window.STORAGE_KEYS.SETTINGS;

  const BUTTON_CLASS = 'hncl-button';
  const SHARE_CLASS = 'hncl-share';
  const COPIED_CLASS = 'hncl-copied';
  const BUBBLE_CLASS = 'hncl-bubble';
  const VISIBLE_CLASS = 'hncl-bubble-visible';
  const FEEDBACK_MS = 1500;

  // Two glyphs rather than two states of one: the copied mark has to be
  // readable at a glance down a list of thirty rows, and a colour change alone
  // is not (and is invisible to a colour-blind reader).
  //
  // Icons are shape lists built with DOM calls, not markup strings: AMO's
  // linter rejects any innerHTML assignment, constant or not.
  const COPY_ICON = [
    ['rect', { x: '5.5', y: '2.5', width: '8', height: '10', rx: '1.5' }],
    ['path', { d: 'M10.5 13.5v0a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 4 3.5h0' }],
  ];
  const COPIED_ICON = [
    ['path', { d: 'M2.5 8.5l4 4 7-8' }],
  ];
  // The share glyph Android itself uses, so a phone reader knows what it opens.
  const SHARE_ICON = [
    ['circle', { cx: '12', cy: '3.5', r: '1.75' }],
    ['circle', { cx: '4', cy: '8', r: '1.75' }],
    ['circle', { cx: '12', cy: '12.5', r: '1.75' }],
    ['path', { d: 'M5.5 7.15l5-2.8M5.5 8.85l5 2.8' }],
  ];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function createIcon(shapes) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const [tag, attributes] of shapes) {
      const shape = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attributes)) {
        shape.setAttribute(name, value);
      }
      svg.appendChild(shape);
    }
    return svg;
  }

  // Decided once: neither the browser nor the platform changes under a page.
  const shareAvailable = isShareSheetAvailable(navigator);

  function message(name) {
    return browserAPI.i18n?.getMessage(name) || name;
  }

  let copiedItems = {};
  let settings = normalizeSettings(null);

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

  async function loadSettings() {
    try {
      const stored = await browserAPI.storage.local.get(SETTINGS_KEY);
      settings = normalizeSettings(stored?.[SETTINGS_KEY]);
    } catch (error) {
      // Same call as above: the defaults are a usable answer, and the page is
      // worth more with the buttons than without them.
      window.errorLog('Failed to read settings', error);
      settings = normalizeSettings(null);
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
    button.replaceChildren(createIcon(copied ? COPIED_ICON : COPY_ICON));
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

  // Hands the same text a copy would write to the share sheet, so a chat app
  // picked from it gets exactly what a paste would have given it.
  async function handleShareClick(event, shareButton, copyButton, item) {
    // Inside the title link, like the copy button.
    event.preventDefault();
    event.stopPropagation();

    // No await before this call - see shareText.
    const result = await shareText(navigator, buildCopyText(item));
    if (result === 'failed') {
      showFeedback(shareButton, message('shareFailedFeedback'));
      return;
    }
    // A sheet closed without a choice took nothing anywhere, so it must not
    // mark the row, for the same reason a failed copy must not.
    if (result !== 'shared') return;

    applyCopiedState(copyButton, true);
    copiedItems = markCopied(copiedItems, item.itemId);
    await persistCopiedItems();
  }

  function createShareButton(item, copyButton) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = SHARE_CLASS;
    button.replaceChildren(createIcon(SHARE_ICON));
    button.title = message('shareButtonTitle');
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', (event) => handleShareClick(event, button, copyButton, item));
    return button;
  }

  function wantsShareButton() {
    return shareAvailable && settings.shareButton === true;
  }

  // Called when the settings change, so it has to be safe over rows that
  // already carry a share button and rows that do not.
  function applyShareSetting(root = document) {
    const wanted = wantsShareButton();

    root.querySelectorAll('tr.athing').forEach((row) => {
      const titleline = row.querySelector('.titleline');
      const copyButton = titleline?.querySelector(`.${BUTTON_CLASS}`);
      if (!copyButton) return;

      const existing = titleline.querySelector(`.${SHARE_CLASS}`);
      if (!wanted) {
        existing?.remove();
        return;
      }
      if (existing) return;

      const item = parseRow(row, document.baseURI);
      if (item) titleline.appendChild(createShareButton(item, copyButton));
    });
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

    if (wantsShareButton()) {
      titleline.appendChild(createShareButton(item, button));
    }
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

  // The settings are changed on the options page, which is a different
  // document. Without this the reader would have to reload Hacker News to see
  // a button appear - and on a phone that means losing their place in the list.
  function handleSettingsChange(changes, area) {
    if (area !== 'local' || !changes?.[SETTINGS_KEY]) return;

    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    applyShareSetting();
  }

  function watchForSettingsChanges() {
    browserAPI.storage.onChanged.addListener(handleSettingsChange);
  }

  async function init() {
    await Promise.all([loadCopiedItems(), loadSettings()]);
    decorateAll();
    watchForNewRows();
    watchForSettingsChanges();
  }

  window.hnCopyLinks = {
    dispose() {
      observer?.disconnect();
      observer = null;
      browserAPI.storage.onChanged.removeListener(handleSettingsChange);
      clearTimeout(bubbleTimer);
      bubble?.remove();
      bubble = null;
    },
  };

  init();
})();
