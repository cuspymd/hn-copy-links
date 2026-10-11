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
  test('points at the story page on the canonical origin, slug on', () => {
    expect(buildCommentsUrl('lhr4oy', 'people_holding')).toBe('https://lobste.rs/s/lhr4oy/people_holding');
  });

  // Logged out, the bare `/s/<id>` is served from a cache frozen at the
  // story's first minutes. The trailing slash is a path of its own.
  test('never falls back to the bare /s/<id>', () => {
    expect(buildCommentsUrl('lhr4oy')).toBe('https://lobste.rs/s/lhr4oy/');
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
      commentsUrl: 'https://lobste.rs/s/lhr4oy/a_slug',
      isSelfPost: false,
    });
  });

  // The anchor reads "no comments" on a fresh story; its href is all that is
  // read, and it carries the slug either way.
  test('takes the slug from the comments link of a story with no comments', () => {
    const row = storyFrom(lobstersStory({ id: 'lhr4oy', title: 'Fresh', href: 'https://example.com/', slug: 'fresh_story' }));
    expect(parseRow(row, BASE).commentsUrl).toBe('https://lobste.rs/s/lhr4oy/fresh_story');
  });

  test('falls back to the mobile comments link', () => {
    const row = storyFrom(lobstersStory({ id: 'lhr4oy', title: 'Fresh', href: 'https://example.com/', slug: 'fresh_story' }));
    row.querySelector('.comments_label').remove();
    expect(parseRow(row, BASE).commentsUrl).toBe('https://lobste.rs/s/lhr4oy/fresh_story');
  });

  test('ends in a slash when no comments link names the story', () => {
    const row = storyFrom(lobstersStory({ id: 'lhr4oy', title: 'Fresh', href: 'https://example.com/' }));
    for (const link of row.querySelectorAll('.comments_label a, a.mobile_comments')) {
      link.setAttribute('href', '/s/zzzzzz/another_story');
    }
    expect(parseRow(row, BASE).commentsUrl).toBe('https://lobste.rs/s/lhr4oy/');
  });

  // The title of a text post links its own story page, slug included, so an
  // equal-string test against the built link would miss it.
  test('reads a text post, whose title carries the slug', () => {
    const row = storyFrom(lobstersStory({ id: 'xff77a', title: 'What are you reading?', href: '/s/xff77a/what_are_you_reading' }));
    const item = parseRow(row, BASE);

    expect(item.isSelfPost).toBe(true);
    expect(item.commentsUrl).toBe('https://lobste.rs/s/xff77a/a_slug');
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
      articleUrl: 'https://sheets.works/a', commentsUrl: 'https://lobste.rs/s/lhr4oy/a_slug', isSelfPost: false,
    })).toBe([
      'Article: https://sheets.works/a',
      'Lobsters discussion: https://lobste.rs/s/lhr4oy/a_slug',
    ].join('\n'));
  });

  test('one line for a text post', () => {
    expect(buildCopyText({ commentsUrl: 'https://lobste.rs/s/xff77a/a_slug', isSelfPost: true }))
      .toBe('Lobsters discussion: https://lobste.rs/s/xff77a/a_slug');
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
