import '../content-scripts/hn-core.js';
import '../content-scripts/lobsters-core.js';
import '../content-scripts/site-core.js';

const { siteForHostname } = window.SiteCore;

describe('siteForHostname', () => {
  test('picks Hacker News', () => {
    expect(siteForHostname('news.ycombinator.com')).toBe(window.HnCore.site);
  });

  test('picks Lobsters', () => {
    expect(siteForHostname('lobste.rs')).toBe(window.LobstersCore.site);
  });

  test('has nothing for any other host', () => {
    expect(siteForHostname('example.com')).toBeNull();
  });

  // Their marks share one map, so the two must never write the same key.
  test('Hacker News ids are stored bare, so marks from older versions still apply', () => {
    expect(window.HnCore.site.storeKey('41000')).toBe('41000');
  });
});
