import fs from 'fs';

// The pure-logic modules `content.js` reads off `window`. They are imported
// rather than evaluated so the coverage instrumenter sees them - the whole
// reason that logic lives outside the content script.
import '../../content-scripts/hn-core.js';
import '../../content-scripts/copied-store-core.js';
import '../../content-scripts/share-core.js';
import '../../shared/logger.js';
import '../../shared/clipboard.js';
import '../../shared/settings-core.js';
import '../../constants/storage-keys.js';

/**
 * Loads `content.js` the way the manifest does.
 *
 * It is not a module a test can import: the manifest injects the scripts in
 * order and they find each other through `window`. So evaluate the source into
 * jsdom with the neighbours already published, then drive it through the DOM.
 *
 * Returns once the script's own init has settled, so a caller can assert on
 * the buttons without a wait of its own.
 */
export async function loadContentScript({ html, url = 'https://news.ycombinator.com/' } = {}) {
  window.browserAPI = global.chrome;

  if (typeof html === 'string') {
    document.body.innerHTML = html;
  }

  // jsdom will not navigate, and `parseRow` resolves relative hrefs against
  // the document URL, so point the base at Hacker News instead.
  const base = document.createElement('base');
  base.href = url;
  document.head.appendChild(base);

  const source = fs.readFileSync(new URL('../../content-scripts/content.js', import.meta.url), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(source).call(window);

  // init() awaits a storage read before it draws anything.
  await flushPromises();
}

export function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** One Hacker News list row, in the shape the site serves. */
export function submissionRow({ id, title, href, site, rank = 1 }) {
  const sitebit = site
    ? `<span class="sitebit comhead"> (<a href="from?site=${site}"><span class="sitestr">${site}</span></a>)</span>`
    : '';
  return `
    <tr id="${id}" class="athing submission">
      <td class="title"><span class="rank">${rank}.</span></td>
      <td class="votelinks"><center><a href="vote?id=${id}"><div class="votearrow"></div></a></center></td>
      <td class="title"><span class="titleline"><a href="${href}">${title}</a>${sitebit}</span></td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="subtext"><span class="subline">
        <span class="score">100 points</span> by <a class="hnuser" href="user?id=someone">someone</a>
        | <a href="item?id=${id}">42&nbsp;comments</a>
      </span></td>
    </tr>
    <tr class="spacer" style="height:5px"></tr>
  `;
}

export function listPage(rows) {
  return `<table><tbody>${rows.map(submissionRow).join('')}</tbody></table>`;
}
