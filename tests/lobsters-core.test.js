import '../content-scripts/lobsters-core.js';
import { lobstersStory } from './helpers/content-script.js';

const { parseRow, buildCopyText, getItemId, buildCommentsUrl, toAbsoluteUrl, site } = window.LobstersCore;
const BASE = 'https://lobste.rs/';

function storyFrom(html) {
  document.body.innerHTML = `<ol class="stories">${html}</ol>`;
  return document.querySelector('li');
}

describe('getItemId', () => {
  test('reads the short id', () => {
    expect(getItemId(storyFrom('<li class="story" data-shortid="lhr4oy"></li>'))).toBe('lhr4oy');
  });

  test('rejects a story without one', () => {
    expect(getItemId(storyFrom('<li class="story"></li>'))).toBeNull();
  });

  test('rejects an id that is not a short id', () => {
    expect(getItemId(storyFrom('<li class="story" data-shortid="../x"></li>'))).toBeNull();
  });

  test('tolerates no row at all', () => {
    expect(getItemId(null)).toBeNull();
  });
});

describe('buildCommentsUrl', () => {
  // Built from the id rather than read off the comments anchor, which reads
  // "no comments" on a fresh story, and without the slug, which is only the
  // title in another form.
  test('points at the story page on the canonical origin', () => {
    expect(buildCommentsUrl('lhr4oy')).toBe('https://lobste.rs/s/lhr4oy');
  });
});

describe('toAbsoluteUrl', () => {
  test('resolves a site-relative href against the page', () => {
    expect(toAbsoluteUrl('/s/abc123/slug', BASE)).toBe('https://lobste.rs/s/abc123/slug');
  });

  test('returns null for a missing href', () => {
    expect(toAbsoluteUrl(null, BASE)).toBeNull();
  });
});

describe('parseRow', () => {
  test('reads a link story', () => {
    const row = storyFrom(lobstersStory({
      id: 'lhr4oy', title: 'The people holding up the internet', href: 'https://sheets.works/a', domain: 'sheets.works',
    }));

    expect(parseRow(row, BASE)).toEqual({
      itemId: 'lhr4oy',
      title: 'The people holding up the internet',
      articleUrl: 'https://sheets.works/a',
      commentsUrl: 'https://lobste.rs/s/lhr4oy',
      isSelfPost: false,
    });
  });

  // The title of a text post links its own story page, slug included, so an
  // equal-string test against the built link would miss it.
  test('reads a text post, whose title carries the slug', () => {
    const row = storyFrom(lobstersStory({ id: 'xff77a', title: 'What are you reading?', href: '/s/xff77a/what_are_you_reading' }));
    const item = parseRow(row, BASE);

    expect(item.isSelfPost).toBe(true);
    expect(item.commentsUrl).toBe('https://lobste.rs/s/xff77a');
  });

  test('does not take a link to another story for a text post', () => {
    const row = storyFrom(lobstersStory({ id: 'aaaaaa', title: 'Follow-up', href: '/s/bbbbbb/original' }));
    expect(parseRow(row, BASE).isSelfPost).toBe(false);
  });

  test('does not take an off-site /s/ path for a text post', () => {
    const row = storyFrom(lobstersStory({ id: 'aaaaaa', title: 'Elsewhere', href: 'https://example.com/s/aaaaaa' }));
    expect(parseRow(row, BASE).isSelfPost).toBe(false);
  });

  test('skips a story with an empty title', () => {
    const row = storyFrom(lobstersStory({ id: 'aaaaaa', title: '  ', href: 'https://example.com/' }));
    expect(parseRow(row, BASE)).toBeNull();
  });

  test('skips an element with no title link', () => {
    expect(parseRow(storyFrom('<li class="story" data-shortid="aaaaaa"><div class="details"></div></li>'), BASE)).toBeNull();
  });
});

describe('buildCopyText', () => {
  test('two lines for a link story', () => {
    expect(buildCopyText({
      articleUrl: 'https://sheets.works/a', commentsUrl: 'https://lobste.rs/s/lhr4oy', isSelfPost: false,
    })).toBe([
      'Article: https://sheets.works/a',
      'Lobsters discussion: https://lobste.rs/s/lhr4oy',
    ].join('\n'));
  });

  test('one line for a text post', () => {
    expect(buildCopyText({ commentsUrl: 'https://lobste.rs/s/xff77a', isSelfPost: true }))
      .toBe('Lobsters discussion: https://lobste.rs/s/xff77a');
  });

  test('nothing for no item', () => {
    expect(buildCopyText(null)).toBe('');
  });
});

describe('site', () => {
  // Hacker News ids are stored bare in the same map, so an all-digit short id
  // stored bare would mark the Hacker News item of that number.
  test('stores its marks under a prefix', () => {
    expect(site.storeKey('123456')).toBe('lobsters:123456');
  });
});
