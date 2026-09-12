import '../shared/clipboard.js';

const copyTextToClipboard = window.copyTextToClipboard;

describe('copyTextToClipboard', () => {
  afterEach(() => {
    delete navigator.clipboard;
    delete document.execCommand;
  });

  test('uses the async clipboard api when it is available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    navigator.clipboard = { writeText };

    await expect(copyTextToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  test('falls back to execCommand when the async api is missing', async () => {
    // The case on older Firefox for Android builds.
    document.execCommand = jest.fn().mockReturnValue(true);

    await expect(copyTextToClipboard('hello')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  test('falls back to execCommand when the async api is denied', async () => {
    navigator.clipboard = { writeText: jest.fn().mockRejectedValue(new Error('denied')) };
    document.execCommand = jest.fn().mockReturnValue(true);

    await expect(copyTextToClipboard('hello')).resolves.toBe(true);
  });

  test('reports failure when both paths fail', async () => {
    navigator.clipboard = { writeText: jest.fn().mockRejectedValue(new Error('denied')) };
    document.execCommand = jest.fn().mockReturnValue(false);

    await expect(copyTextToClipboard('hello')).resolves.toBe(false);
  });

  test('leaves no textarea behind', async () => {
    document.execCommand = jest.fn().mockReturnValue(true);
    await copyTextToClipboard('hello');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
