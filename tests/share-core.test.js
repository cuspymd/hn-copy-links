import '../content-scripts/share-core.js';

const { isShareSheetAvailable, shareText } = window.ShareCore;

const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function fakeNavigator({ userAgent = FIREFOX_ANDROID, share = jest.fn().mockResolvedValue(undefined), canShare } = {}) {
  return { userAgent, share, ...(canShare ? { canShare } : {}) };
}

function domError(name) {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('isShareSheetAvailable', () => {
  test('is true on Android with the Web Share API', () => {
    expect(isShareSheetAvailable(fakeNavigator())).toBe(true);
  });

  // Chrome on the desktop has the API, but its sheet is not where chat apps are.
  test('is false off Android even where the API exists', () => {
    expect(isShareSheetAvailable(fakeNavigator({ userAgent: CHROME_WINDOWS }))).toBe(false);
  });

  test('is false on Android without the API', () => {
    expect(isShareSheetAvailable(fakeNavigator({ share: null }))).toBe(false);
  });

  test('asks canShare where there is one', () => {
    const canShare = jest.fn().mockReturnValue(false);
    expect(isShareSheetAvailable(fakeNavigator({ canShare }))).toBe(false);
    expect(canShare).toHaveBeenCalledWith({ text: expect.any(String) });
  });

  test('takes a throwing canShare as a no', () => {
    const canShare = () => { throw new Error('nope'); };
    expect(isShareSheetAvailable(fakeNavigator({ canShare }))).toBe(false);
  });

  test('is false for no navigator at all', () => {
    expect(isShareSheetAvailable(undefined)).toBe(false);
  });
});

describe('shareText', () => {
  test('hands the text over as text, and nothing else', async () => {
    const nav = fakeNavigator();

    await expect(shareText(nav, 'Article: a\nHN discussion: b')).resolves.toBe('shared');
    expect(nav.share).toHaveBeenCalledWith({ text: 'Article: a\nHN discussion: b' });
  });

  // The call needs the click's user activation, which an await would spend.
  test('calls share before it awaits anything', () => {
    const nav = fakeNavigator();

    shareText(nav, 'text');

    expect(nav.share).toHaveBeenCalledTimes(1);
  });

  test('a closed sheet is a cancel, not a failure', async () => {
    const nav = fakeNavigator({ share: jest.fn().mockRejectedValue(domError('AbortError')) });
    await expect(shareText(nav, 'text')).resolves.toBe('cancelled');
  });

  test('a second tap while the sheet is open is a cancel too', async () => {
    const nav = fakeNavigator({ share: jest.fn().mockRejectedValue(domError('InvalidStateError')) });
    await expect(shareText(nav, 'text')).resolves.toBe('cancelled');
  });

  test('anything else is a failure', async () => {
    const nav = fakeNavigator({ share: jest.fn().mockRejectedValue(domError('NotAllowedError')) });
    await expect(shareText(nav, 'text')).resolves.toBe('failed');
  });
});
