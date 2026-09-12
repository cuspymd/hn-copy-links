// Picks the extension namespace: `browser` on Firefox, `chrome` on Chrome.
// This is not a polyfill - it returns that object unchanged, so the two APIs'
// differences reach the caller. Always use the promise form of async APIs and
// never pass a callback: on Firefox a callback in a trailing options slot is
// simply never called, so the code goes silently dead rather than failing.
(function () {
  if (typeof browser !== 'undefined') {
    window.browserAPI = browser;
    return;
  }
  if (typeof chrome !== 'undefined') {
    window.browserAPI = chrome;
    return;
  }
  throw new Error('Neither browser nor chrome API is available');
})();
