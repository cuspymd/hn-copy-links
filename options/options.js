// The options page. It owns no logic of its own: it reads the settings map,
// flips one key through `SettingsCore` and writes it back. The content script
// hears the write through `storage.onChanged` and redraws without a reload.
(function () {
  const browserAPI = window.browserAPI;
  const SETTINGS_KEY = window.STORAGE_KEYS.SETTINGS;
  const { normalizeSettings, withSetting } = window.SettingsCore;
  const STATUS_MS = 1500;

  const status = document.getElementById('status');
  // Every control that names a settings key in `data-setting`.
  const checkboxes = Array.from(document.querySelectorAll('input[data-setting]'));

  let settings = normalizeSettings(null);
  let statusTimer = null;

  function message(name) {
    return browserAPI.i18n?.getMessage(name) || name;
  }

  // The HTML carries message names rather than text: `__MSG_*__` substitution
  // only happens in the manifest and in CSS, never in an extension page.
  function localize() {
    for (const element of document.querySelectorAll('[data-i18n]')) {
      element.textContent = message(element.dataset.i18n);
    }
  }

  function showStatus(name) {
    status.textContent = message(name);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ''; }, STATUS_MS);
  }

  function showSettings() {
    for (const checkbox of checkboxes) {
      checkbox.checked = settings[checkbox.dataset.setting] === true;
    }
  }

  async function load() {
    try {
      const stored = await browserAPI.storage.local.get(SETTINGS_KEY);
      settings = normalizeSettings(stored?.[SETTINGS_KEY]);
    } catch (error) {
      window.errorLog('Failed to read settings', error);
      settings = normalizeSettings(null);
    }
    showSettings();
  }

  async function save(key, checked) {
    const next = withSetting(settings, key, checked);
    try {
      await browserAPI.storage.local.set({ [SETTINGS_KEY]: next });
    } catch (error) {
      // Put the control back where storage still says it is, rather than
      // leaving a checkbox that claims a setting nothing saved.
      window.errorLog('Failed to save settings', error);
      showSettings();
      showStatus('settingsSaveFailedStatus');
      return;
    }
    settings = next;
    showStatus('settingsSavedStatus');
  }

  localize();
  for (const checkbox of checkboxes) {
    checkbox.addEventListener('change', () => save(checkbox.dataset.setting, checkbox.checked));
  }
  load();
})();
