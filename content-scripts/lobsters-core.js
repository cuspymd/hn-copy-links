// Pure logic: read a Lobsters story and turn it into the text that goes on the
// clipboard. The Lobsters twin of hn-core.js; no extension API and no DOM
// mutation, so tests drive it directly.
(function () {
  const LOBSTERS_ORIGIN = 'https://lobste.rs';

  // Not localized, for the same reason as the Hacker News labels.
  const ARTICLE_LABEL = 'Article';
  const DISCUSSION_LABEL = 'Lobsters discussion';

  // Lobsters story ids are short lowercase alphanumerics ("lhr4oy").
  function getItemId(row) {
    const id = row?.dataset?.shortid;
    return /^[a-z0-9]+$/i.test(id || '') ? id : null;
  }

  // The story page also answers without its slug, and the slug is only a
  // rendering of the title, so the id alone is the stable link.
  function buildCommentsUrl(itemId) {
    return `${LOBSTERS_ORIGIN}/s/${itemId}`;
  }

  function toAbsoluteUrl(href, baseUrl) {
    if (typeof href !== 'string' || !href.trim()) return null;

    try {
      return new URL(href, baseUrl || LOBSTERS_ORIGIN).href;
    } catch (error) {
      return null;
    }
  }

  // A text post points its title at its own story page, but with the slug on:
  // `/s/<id>/<slug>`. So it is told apart by path, not by an equal string.
  function isOwnStoryPage(url, itemId) {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== LOBSTERS_ORIGIN) return false;
      const [, prefix, id] = parsed.pathname.split('/');
      return prefix === 's' && id === itemId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pull what a copy needs out of one `li.story`.
   *
   * Returns null for anything that only looks like a story, so the caller can
   * skip it without knowing how Lobsters marks them.
   */
  function parseRow(row, baseUrl) {
    const itemId = getItemId(row);
    if (!itemId) return null;

    const titleLink = row.querySelector('.details .link > a.u-url');
    if (!titleLink) return null;

    const title = (titleLink.textContent || '').trim();
    if (!title) return null;

    const articleUrl = toAbsoluteUrl(titleLink.getAttribute('href'), baseUrl);

    return {
      itemId,
      title,
      articleUrl,
      commentsUrl: buildCommentsUrl(itemId),
      isSelfPost: isOwnStoryPage(articleUrl, itemId),
    };
  }

  function buildCopyText(item) {
    if (!item) return '';

    const lines = [];
    if (!item.isSelfPost) {
      lines.push(`${ARTICLE_LABEL}: ${item.articleUrl}`);
    }
    lines.push(`${DISCUSSION_LABEL}: ${item.commentsUrl}`);
    return lines.join('\n');
  }

  window.LobstersCore = {
    LOBSTERS_ORIGIN,
    getItemId,
    buildCommentsUrl,
    toAbsoluteUrl,
    parseRow,
    buildCopyText,
    // What content.js needs to decorate this site. The copied-items map is
    // shared with Hacker News, whose ids are bare numbers, so these ids carry a
    // prefix: an all-digit short id must not mark a Hacker News row.
    site: {
      name: 'lobsters',
      hostname: 'lobste.rs',
      rowSelector: 'li.story',
      titleSelector: '.details .link',
      storeKey: (itemId) => `lobsters:${itemId}`,
      parseRow,
      buildCopyText,
    },
  };
})();
