import '../shared/settings-core.js';

const { DEFAULT_SETTINGS, normalizeSettings, withSetting } = window.SettingsCore;

describe('normalizeSettings', () => {
  test('answers the defaults when nothing was ever written', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  test('has the share button on by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ shareButton: true });
  });

  test('keeps a stored boolean', () => {
    expect(normalizeSettings({ shareButton: false }).shareButton).toBe(false);
  });

  // A half-written map is what an older version leaves behind, and a caller
  // reading `settings.shareButton` must not get `undefined` from it.
  test('fills in a key the stored map never had', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  test('ignores a value that is not a boolean', () => {
    expect(normalizeSettings({ shareButton: 'yes' })).toEqual(DEFAULT_SETTINGS);
  });

  test('ignores something that is not an object at all', () => {
    expect(normalizeSettings('on')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  test('drops a key that is not a setting', () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, somethingElse: true })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('withSetting', () => {
  test('changes the key it is given', () => {
    expect(withSetting(DEFAULT_SETTINGS, 'shareButton', false).shareButton).toBe(false);
  });

  test('does not touch the map it was given', () => {
    const settings = { shareButton: true };
    withSetting(settings, 'shareButton', false);
    expect(settings.shareButton).toBe(true);
  });

  test('coerces whatever a control reports into a boolean', () => {
    expect(withSetting(DEFAULT_SETTINGS, 'shareButton', 0).shareButton).toBe(false);
  });

  test('refuses a key that is not a setting', () => {
    expect(withSetting(DEFAULT_SETTINGS, 'nonsense', true)).toEqual(DEFAULT_SETTINGS);
  });
});
