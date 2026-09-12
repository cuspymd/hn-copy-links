// Pure logic: the map of item ids that have been copied, and the rules that
// keep it from growing without bound.
(function () {
  const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  const MAX_ENTRIES = 5000;

  function isValidEntry(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  /**
   * Drop entries older than the cutoff, then the oldest of whatever is left
   * until the map fits. Entries with a broken timestamp are dropped too -
   * they cannot be ordered, so keeping them would make the count unbounded.
   */
  function pruneCopied(map, now = Date.now()) {
    const cutoff = now - MAX_AGE_MS;
    const entries = Object.entries(map || {})
      .filter(([, copiedAt]) => isValidEntry(copiedAt) && copiedAt > cutoff)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ENTRIES);

    return Object.fromEntries(entries);
  }

  function markCopied(map, itemId, now = Date.now()) {
    if (!itemId) return { ...(map || {}) };
    return pruneCopied({ ...(map || {}), [itemId]: now }, now);
  }

  function isCopied(map, itemId) {
    return isValidEntry(map?.[itemId]);
  }

  window.CopiedStoreCore = {
    MAX_AGE_MS,
    MAX_ENTRIES,
    pruneCopied,
    markCopied,
    isCopied,
  };
})();
