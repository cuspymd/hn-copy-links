import fs from 'fs';
import '../shared/logger.js';
import '../shared/settings-core.js';
import '../constants/storage-keys.js';

const SETTINGS_KEY = 'settings';
const { DEFAULT_SETTINGS } = window.SettingsCore;

// The options page is a document of its own, so the test builds it the way the
// browser does: the markup, then the scripts it lists, in that order.
async function loadOptionsPage() {
  window.browserAPI = global.chrome;

  const html = fs.readFileSync(new URL('../options/options.html', import.meta.url), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<main'), html.indexOf('</main>') + '</main>'.length);

  const source = fs.readFileSync(new URL('../options/options.js', import.meta.url), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(source).call(window);

  // The script reads storage before it can answer for the checkbox.
  await flushPromises();
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function checkbox() {
  return document.querySelector('input[data-setting="shareButton"]');
}

async function toggleTo(checked) {
  checkbox().checked = checked;
  checkbox().dispatchEvent(new Event('change'));
  await flushPromises();
}

// A control naming a key the settings map does not have would save nothing
// and say "Saved".
test('has a control for every setting, and none for anything else', async () => {
  await loadOptionsPage();

  const keys = Array.from(document.querySelectorAll('input[data-setting]'), (input) => input.dataset.setting);
  expect(keys.sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
});

test('shows the default when nothing was ever saved', async () => {
  await loadOptionsPage();

  expect(checkbox().checked).toBe(true);
});

test('shows what storage says', async () => {
  await chrome.storage.local.set({ [SETTINGS_KEY]: { shareButton: false } });

  await loadOptionsPage();

  expect(checkbox().checked).toBe(false);
});

test('writes the whole settings map', async () => {
  await loadOptionsPage();

  await toggleTo(false);

  expect(chrome.storage.local.__store.get(SETTINGS_KEY)).toEqual({ shareButton: false });
});

test('says so after a save', async () => {
  await loadOptionsPage();

  await toggleTo(false);

  expect(document.getElementById('status').textContent).toBe('settingsSavedStatus');
});

// A checkbox left claiming a setting that nothing saved is worse than no
// feedback at all: the next page load would silently disagree with it.
test('puts the control back when the write fails', async () => {
  await loadOptionsPage();
  const set = jest.spyOn(chrome.storage.local, 'set').mockRejectedValue(new Error('no storage'));

  try {
    await toggleTo(false);
  } finally {
    set.mockRestore();
  }

  expect(checkbox().checked).toBe(true);
  expect(document.getElementById('status').textContent).toBe('settingsSaveFailedStatus');
});

test('replaces the message names in the markup with messages', async () => {
  await loadOptionsPage();

  expect(document.querySelectorAll('[data-i18n]').length).toBeGreaterThan(0);
  for (const element of document.querySelectorAll('[data-i18n]')) {
    // The mock answers with the name, which is what the unit suite asserts on
    // elsewhere; what matters here is that nothing was left empty.
    expect(element.textContent).toBe(element.dataset.i18n);
  }
});

test('still shows the page when the storage read fails', async () => {
  const get = jest.spyOn(chrome.storage.local, 'get').mockRejectedValue(new Error('no storage'));

  try {
    await loadOptionsPage();
  } finally {
    get.mockRestore();
  }

  expect(checkbox().checked).toBe(true);
});

// The whole row is the target on a phone, so the label has to point at the box.
test('the label belongs to its checkbox', async () => {
  await loadOptionsPage();

  expect(document.querySelector(`label[for="${checkbox().id}"]`)).not.toBeNull();
});
