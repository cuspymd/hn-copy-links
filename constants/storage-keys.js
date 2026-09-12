// The authority on storage key shapes. Read it rather than composing keys by hand.
(function () {
  window.STORAGE_KEYS = {
    // Map of Hacker News item id -> epoch ms of the last copy.
    COPIED_ITEMS: 'copiedItems',
  };
})();
