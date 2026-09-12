import '../content-scripts/copied-store-core.js';

const { pruneCopied, markCopied, isCopied, MAX_AGE_MS, MAX_ENTRIES } = window.CopiedStoreCore;
const NOW = 1_760_000_000_000;

describe('markCopied', () => {
  test('records the copy time under the item id', () => {
    expect(markCopied({}, '7', NOW)).toEqual({ 7: NOW });
  });

  test('keeps earlier entries', () => {
    const map = markCopied({ 6: NOW - 1000 }, '7', NOW);
    expect(Object.keys(map).sort()).toEqual(['6', '7']);
  });

  test('overwrites the time when the same item is copied again', () => {
    const map = markCopied({ 7: NOW - 5000 }, '7', NOW);
    expect(map[7]).toBe(NOW);
  });

  test('ignores a missing item id rather than writing an undefined key', () => {
    expect(markCopied({ 7: NOW }, null, NOW)).toEqual({ 7: NOW });
  });

  test('does not mutate the map it was given', () => {
    const original = { 6: NOW };
    markCopied(original, '7', NOW);
    expect(original).toEqual({ 6: NOW });
  });
});

describe('pruneCopied', () => {
  test('drops entries past the age cutoff', () => {
    const map = { fresh: NOW - 1000, stale: NOW - MAX_AGE_MS - 1 };
    expect(pruneCopied(map, NOW)).toEqual({ fresh: NOW - 1000 });
  });

  test('keeps an entry exactly inside the cutoff', () => {
    const map = { edge: NOW - MAX_AGE_MS + 1 };
    expect(pruneCopied(map, NOW)).toEqual(map);
  });

  test('keeps the newest entries when the map is over the size limit', () => {
    const map = {};
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      map[`item${i}`] = NOW - i * 1000;
    }

    const pruned = pruneCopied(map, NOW);
    expect(Object.keys(pruned)).toHaveLength(MAX_ENTRIES);
    expect(pruned.item0).toBe(NOW);
    expect(pruned[`item${MAX_ENTRIES + 5}`]).toBeUndefined();
  });

  test('drops entries whose timestamp is not a finite number', () => {
    const map = { good: NOW, broken: 'yesterday', alsoBroken: NaN, nullish: null };
    expect(pruneCopied(map, NOW)).toEqual({ good: NOW });
  });

  test('handles an empty or missing map', () => {
    expect(pruneCopied({}, NOW)).toEqual({});
    expect(pruneCopied(undefined, NOW)).toEqual({});
  });
});

describe('isCopied', () => {
  test('true only for an entry with a real timestamp', () => {
    expect(isCopied({ 7: NOW }, '7')).toBe(true);
    expect(isCopied({ 7: NOW }, '8')).toBe(false);
    expect(isCopied({ 7: 'nope' }, '7')).toBe(false);
    expect(isCopied(undefined, '7')).toBe(false);
  });
});
