import '../content-scripts/hn-core.js';

const { parseRow, buildCopyText, toAbsoluteUrl, getItemId, buildCommentsUrl } = window.HnCore;
const BASE = 'https://news.ycombinator.com/news';

function rowFrom(html) {
  document.body.innerHTML = `<table><tbody>${html}</tbody></table>`;
  return document.querySelector('tr');
}

describe('getItemId', () => {
  test('reads a numeric row id', () => {
    expect(getItemId(rowFrom('<tr id="12345" class="athing"></tr>'))).toBe('12345');
  });

  test('rejects a row without an id', () => {
    expect(getItemId(rowFrom('<tr class="athing"></tr>'))).toBeNull();
  });

  test('rejects a non-numeric id', () => {
    expect(getItemId(rowFrom('<tr id="pagespace" class="athing"></tr>'))).toBeNull();
  });

  test('tolerates no row at all', () => {
    expect(getItemId(null)).toBeNull();
  });
});

describe('buildCommentsUrl', () => {
  // Built from the row id rather than the "N comments" anchor, which reads
  // "discuss" on a submission with no comments yet.
  test('points at the item page on the canonical origin', () => {
    expect(buildCommentsUrl('99')).toBe('https://news.ycombinator.com/item?id=99');
  });
});

describe('toAbsoluteUrl', () => {
  test('leaves an absolute url alone', () => {
    expect(toAbsoluteUrl('https://example.com/post', BASE)).toBe('https://example.com/post');
  });

  test('resolves a site-relative href against the page', () => {
    expect(toAbsoluteUrl('item?id=7', BASE)).toBe('https://news.ycombinator.com/item?id=7');
  });

  test('returns null for an unparseable href', () => {
    expect(toAbsoluteUrl(null, BASE)).toBeNull();
  });
});

describe('parseRow', () => {
  test('reads an external submission', () => {
    const row = rowFrom(`
      <tr id="41000" class="athing submission">
        <td class="title"><span class="titleline"><a href="https://example.com/a">A real post</a>
        <span class="sitebit comhead"> (<a href="from?site=example.com"><span class="sitestr">example.com</span></a>)</span></span></td>
      </tr>`);

    expect(parseRow(row, BASE)).toEqual({
      itemId: '41000',
      title: 'A real post',
      articleUrl: 'https://example.com/a',
      commentsUrl: 'https://news.ycombinator.com/item?id=41000',
      isSelfPost: false,
    });
  });

  test('marks an Ask HN post as a self post', () => {
    const row = rowFrom(`
      <tr id="41001" class="athing submission">
        <td class="title"><span class="titleline"><a href="item?id=41001">Ask HN: how do you read HN?</a></span></td>
      </tr>`);

    const item = parseRow(row, BASE);
    expect(item.isSelfPost).toBe(true);
    expect(item.articleUrl).toBe(item.commentsUrl);
  });

  test('skips a row with no title line', () => {
    expect(parseRow(rowFrom('<tr id="41002" class="athing"><td></td></tr>'), BASE)).toBeNull();
  });

  test('skips a row with an empty title', () => {
    const row = rowFrom('<tr id="41003" class="athing"><td><span class="titleline"><a href="/x"></a></span></td></tr>');
    expect(parseRow(row, BASE)).toBeNull();
  });

  test('skips the spacer and more rows, which carry no numeric id', () => {
    const row = rowFrom('<tr class="morespace" style="height:10px"></tr>');
    expect(parseRow(row, BASE)).toBeNull();
  });

  test('trims whitespace the site leaves around a title', () => {
    const row = rowFrom(`
      <tr id="41004" class="athing">
        <td><span class="titleline"><a href="https://example.com/b">
          Padded title
        </a></span></td>
      </tr>`);
    expect(parseRow(row, BASE).title).toBe('Padded title');
  });
});

describe('buildCopyText', () => {
  test('three lines for an external submission', () => {
    const text = buildCopyText({
      title: 'A real post',
      articleUrl: 'https://example.com/a',
      commentsUrl: 'https://news.ycombinator.com/item?id=41000',
      isSelfPost: false,
    });

    expect(text).toBe([
      'A real post',
      'Article: https://example.com/a',
      'HN discussion: https://news.ycombinator.com/item?id=41000',
    ].join('\n'));
  });

  test('two lines for a self post, rather than the same url twice', () => {
    const url = 'https://news.ycombinator.com/item?id=41001';
    const text = buildCopyText({
      title: 'Ask HN: how do you read HN?',
      articleUrl: url,
      commentsUrl: url,
      isSelfPost: true,
    });

    expect(text).toBe(`Ask HN: how do you read HN?\nHN discussion: ${url}`);
  });

  test('returns an empty string for no item', () => {
    expect(buildCopyText(null)).toBe('');
  });
});
