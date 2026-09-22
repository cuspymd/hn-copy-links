// Pure logic: the settings map and the rules that turn whatever storage hands
// back into a complete object. No extension API, so tests drive it directly.
(function () {
  // On by default: the one-tap path from a row to a chat app is what the share
  // button is for. It only ever appears where there is a share sheet to open,
  // so the default costs a desktop reader nothing.
  const DEFAULT_SETTINGS = Object.freeze({
    shareButton: true,
  });

  /**
   * Fill in every key from the defaults and drop everything else.
   *
   * Storage can hand back `undefined` (nothing written yet), a value written
   * by an older version that knew fewer keys, or - if anything else ever wrote
   * the key - something that is not an object at all. A caller that reads
   * `settings.shareButton` must not have to care which.
   */
  function normalizeSettings(stored) {
    const source = stored && typeof stored === 'object' ? stored : {};
    const settings = { ...DEFAULT_SETTINGS };

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof source[key] === 'boolean') settings[key] = source[key];
    }
    return settings;
  }

  /** A new settings map with one key changed. Never mutates the argument. */
  function withSetting(settings, key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
      return normalizeSettings(settings);
    }
    return normalizeSettings({ ...normalizeSettings(settings), [key]: Boolean(value) });
  }

  window.SettingsCore = {
    DEFAULT_SETTINGS,
    normalizeSettings,
    withSetting,
  };
})();
