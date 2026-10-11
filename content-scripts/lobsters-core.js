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

  // A story page path: `/s/<id>` with an optional `/<slug>`. Null for anything
  // else, an off-site link included.
  function parseStoryPath(url) {
    try {
      const parsed = new URL(url, LOBSTERS_ORIGIN);
      if (parsed.origin !== LOBSTERS_ORIGIN) return null;
      const [, prefix, id, slug = ''] = parsed.pathname.split('/');
      if (prefix !== 's' || !id) return null;
      return { id, slug };
    } catch (error) {
      return null;
    }
  }

  // The slug the story's own comments link carries. The anchor is there even
  // on a story with no comments - it reads "no comments" - and only its href
  // is used.
  function findSlug(row, itemId) {
    for (const link of row.querySelectorAll('.comments_label a, a.mobile_comments')) {
      const path = parseStoryPath(link.getAttribute('href'));
      if (path?.id === itemId && /^[a-z0-9_-]+$/i.test(path.slug)) return path.slug;
    }
    return null;
  }

  // The slug stays on: logged out, the bare `/s/<id>` is answered from a cache
  // that stops at the story's first minutes, comments and votes missing, and
  // whatever opens the pasted link is logged out. Any other path under the id
  // is served fresh, so a slug gone stale after a title edit still works, and
  // a story whose slug cannot be read gets the trailing slash alone.
  function buildCommentsUrl(itemId, slug) {
    return `${LOBSTERS_ORIGIN}/s/${itemId}/${slug || ''}`;
  }

  function toAbsoluteUrl(href, baseUrl) {
    if (typeof href !== 'string' || !href.trim()) return null;

    try {
      return new URL(href, baseUrl || LOBSTERS_ORIGIN).href;
    } catch (error) {
      return null;
    }
  }

  // A text post points its title at its own story page, with the slug on. So
  // it is told apart by the path's id, not by an equal string.
  function isOwnStoryPage(url, itemId) {
    if (!url) return true;
    return parseStoryPath(url)?.id === itemId;
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
      commentsUrl: buildCommentsUrl(itemId, findSlug(row, itemId)),
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
