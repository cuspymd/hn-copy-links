// Pure logic: read a Hacker News list row and turn it into the text that goes
// on the clipboard. No extension API and no DOM mutation, so tests drive it
// directly.
(function () {
  const HN_ORIGIN = 'https://news.ycombinator.com';

  // Labels in the copied text are deliberately not localized. The text is
  // pasted into an AI chat, where English labels read best regardless of the
  // browser's UI language, and a fixed format keeps the tests meaningful.
  const ARTICLE_LABEL = 'Article';
  const DISCUSSION_LABEL = 'HN discussion';

  function getItemId(row) {
    const id = row?.id;
    return /^[0-9]+$/.test(id || '') ? id : null;
  }

  function buildCommentsUrl(itemId) {
    return `${HN_ORIGIN}/item?id=${itemId}`;
  }

  function toAbsoluteUrl(href, baseUrl) {
    // A missing href has to fail here rather than reach `new URL`, which
    // stringifies null into the relative path "null" and resolves it happily.
    if (typeof href !== 'string' || !href.trim()) return null;

    try {
      return new URL(href, baseUrl || HN_ORIGIN).href;
    } catch (error) {
      return null;
    }
  }

  /**
   * Pull what a copy needs out of one `tr.athing` row.
   *
   * Returns null for rows that are not submissions - the spacer rows, the
   * "More" row, comment rows - so the caller can skip them without knowing
   * how Hacker News marks them.
   */
  function parseRow(row, baseUrl) {
    const itemId = getItemId(row);
    if (!itemId) return null;

    const titleLink = row.querySelector('.titleline > a');
    if (!titleLink) return null;

    // The title does not go on the clipboard. It is read because an empty one
    // is the sign of a row that only looks like a submission.
    const title = (titleLink.textContent || '').trim();
    if (!title) return null;

    const commentsUrl = buildCommentsUrl(itemId);
    const articleUrl = toAbsoluteUrl(titleLink.getAttribute('href'), baseUrl);

    return {
      itemId,
      title,
      articleUrl,
      commentsUrl,
      // Ask HN and other text posts point their title at the item page itself.
      isSelfPost: !articleUrl || articleUrl === commentsUrl,
    };
  }

  /**
   * Two lines: the article and the discussion. The title is left out - whatever
   * reads the pasted text fetches both pages anyway, so the title only repeats
   * what they already say.
   *
   * A text post has no separate article, so it copies as one line. Repeating
   * the same URL under two labels would only tell the reader the two are
   * different when they are not.
   */
  function buildCopyText(item) {
    if (!item) return '';

    const lines = [];
    if (!item.isSelfPost) {
      lines.push(`${ARTICLE_LABEL}: ${item.articleUrl}`);
    }
    lines.push(`${DISCUSSION_LABEL}: ${item.commentsUrl}`);
    return lines.join('\n');
  }

  window.HnCore = {
    HN_ORIGIN,
    getItemId,
    buildCommentsUrl,
    toAbsoluteUrl,
    parseRow,
    buildCopyText,
  };
})();
