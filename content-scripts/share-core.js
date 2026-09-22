// Pure logic: whether this browser offers a share sheet worth a button, and
// handing text to it. The navigator is passed in rather than read off the
// global, so tests can stand in any browser they like.
(function () {
  /**
   * True only on Android, and only where the Web Share API is really there.
   *
   * The API alone is not the test. Chrome on Windows and macOS has it too, but
   * its sheet offers the OS share targets - mail, nearby devices - and not the
   * chat apps this button exists for. Firefox on the desktop does not have it
   * at all. On Android the same call opens the system chooser, where the chat
   * apps are.
   */
  function isShareSheetAvailable(nav) {
    if (!nav || typeof nav.share !== 'function') return false;
    if (!/Android/i.test(nav.userAgent || '')) return false;

    // `canShare` came later than `share`; where it is missing, `share` is all
    // there is to go on.
    if (typeof nav.canShare === 'function') {
      try {
        return nav.canShare({ text: 'x' }) === true;
      } catch (error) {
        return false;
      }
    }
    return true;
  }

  /**
   * Open the share sheet with `text`, and say how it went: 'shared',
   * 'cancelled' or 'failed'.
   *
   * `share` is called before anything is awaited. It needs the click's user
   * activation, and an await in front of it would spend that.
   *
   * Everything goes in `text`, never `url`: a receiving app is free to keep
   * only one of the two, and a row has two links to hand over.
   */
  async function shareText(nav, text) {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (error) {
      // AbortError: the reader closed the sheet. InvalidStateError: a sheet is
      // already open, from a second tap. Neither is worth a word.
      if (error?.name === 'AbortError' || error?.name === 'InvalidStateError') {
        return 'cancelled';
      }
      return 'failed';
    }
  }

  window.ShareCore = {
    isShareSheetAvailable,
    shareText,
  };
})();
