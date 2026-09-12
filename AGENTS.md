# AGENTS.md

This file provides guidance to coding agents when working with this repository.
It covers only what the code does not say for itself - the traps, the reasons,
and the commands. For structure, read the tree.

"HN Copy Links" is a cross-browser (Chrome, Firefox, Firefox for Android)
extension that puts a copy button next to every Hacker News submission title.
One click writes the title, the article link and the discussion link to the
clipboard, for pasting into an AI chat. Rows already copied stay marked, so a
list still separates into read and unread even though the titles were never
clicked.

## Essential Commands

### Testing
- `npm test` - Jest unit and integration tests (`tests/`)
- `npm run test:e2e` - Playwright E2E tests (`e2e-tests/`); run `npm run deploy:chrome` first, they load `dist/`

### Development Builds
- `npm run deploy` - Build both Chrome (`dist/`) and Firefox (`dist-firefox/`)
- `npm run deploy:chrome` / `npm run deploy:firefox` - Build one of them

### Version Release Builds
- `npm run version-deploy -- <version> chrome` - Bump `manifest.json`, force debug off, build, zip to `outputs/`
- `npm run version-deploy -- <version> firefox` - The same for `manifest-firefox.json`

### Other
- `npm run link-skills` - Link `.claude/skills` to `.agents/skills`; run once per clone
- `node scripts/make-icons.cjs` - Redraw `images/icon*.png`; only needed if the mark changes

## Loading Extensions

- Chrome: load unpacked from `dist/` via `chrome://extensions`
- Firefox: load temporary add-on from `dist-firefox/manifest.json` via `about:debugging`

## There is no background script

Everything happens in the content script. The extension asks for `storage` and
for `https://news.ycombinator.com/*`, and nothing else - no popup, no options
page, no service worker. Keep it that way unless a feature genuinely cannot be
done in the page: both stores review a permission list, and this one needs no
explaining.

## Content script structure

The scripts are injected in the order the manifest lists and find each other
through `window`, so each file is an IIFE that publishes one namespace:

- `content-scripts/hn-core.js` - `window.HnCore`: reading a row, building URLs and the copied text
- `content-scripts/copied-store-core.js` - `window.CopiedStoreCore`: the copied-items map and its pruning
- `content-scripts/content.js` - the only file that touches the DOM or an extension API

The split is for testability. The core files are importable, so tests call them
directly and the coverage instrumenter sees them; `content.js` has to be
evaluated, and evaluated scripts report 0% whether or not a test drove them. Put
new pure logic in a core file rather than in `content.js`, and add any new file
to `content_scripts[0].js` in **both** manifests, before the scripts that read
it. `tests/packaging.test.js` fails if the two manifests drift apart or if a
listed file is missing.

## The discussion link is built, not found

`buildCommentsUrl` composes `item?id=<row id>` from the row's own id attribute.
The obvious alternative - reading the "N comments" anchor out of the subtext row
- breaks on any submission with no comments yet, where that anchor reads
"discuss". There is an E2E test for exactly that row.

For the same reason the article link is resolved against `document.baseURI`
rather than `location.href`: that is what the browser itself resolves the title
link against, and it is what makes the jsdom tests able to stand in for a page
served from Hacker News.

## Text posts

An Ask HN or Tell HN submission points its title at its own item page, so the
article link and the discussion link are the same URL. `parseRow` reports that
as `isSelfPost` and `buildCopyText` then emits two lines instead of three.
Printing the same URL under two labels would tell the reader the two are
different when they are not.

## Copied text is deliberately not localized

The UI strings live in `_locales/`, but the `Article:` and `HN discussion:`
labels in the copied text are constants in `hn-core.js`. That text is pasted
into an AI chat, where English labels read best whatever the browser's UI
language is, and a fixed format is what makes the tests worth having.

## Clipboard

`shared/clipboard.js` tries `navigator.clipboard.writeText` and falls back to a
hidden textarea with `execCommand('copy')`. The fallback is there for Firefox
for Android, where the async API is unavailable or denied on some versions. Both
paths need a user gesture, which a click handler is - do not move a copy onto a
timer or a message handler without rechecking that.

A failed copy shows the failure and leaves the row unmarked. Marking a row whose
text never reached the clipboard is the one wrong answer here: the user would
skip an article they never read.

## Double injection

`content.js` calls `window.hnCopyLinks?.dispose()` before it starts and
publishes its own `dispose` afterwards. Injected twice on one page, the first
instance's MutationObserver would otherwise keep running and decorate new rows
from its own stale copy of the map. The unit suite relies on this too: each
`loadContentScript` stands the previous instance down.

## Testing content scripts

`content.js` is not importable. `tests/helpers/content-script.js` loads it the
way the manifest does - publish the neighbours on `window`, evaluate the source,
wait for its init to settle - and hands back a page whose DOM a test can drive.
Use it rather than evaluating the source by hand, so every test goes through
`mocks/chrome.js` and a guard added there reaches all of them.

`mocks/chrome.js` throws when an async storage call is passed a callback. Always
use the promise form: on Firefox a callback in a trailing options slot is simply
never called, so the code goes silently dead rather than failing loudly, and the
E2E suite runs on Chromium only - a green run there says nothing about Firefox.

`submissionRow()` in the same helper builds a row in the shape Hacker News
serves, including the subtext and spacer rows that must be left alone.

## E2E tests

The content script only matches `news.ycombinator.com`, so the page under test
has to carry that URL. `e2e-tests/fixtures.js` routes the origin on the browser
context and fulfils it from `e2e-tests/news-list.html`, a trimmed copy of the
front page markup. The tests therefore need no network, and a Hacker News
redesign breaks them when the fixture is updated rather than at random.

Two platform details are handled in the fixtures, not the assertions:

- Windows returns clipboard text with CRLF whatever was written, so
  `readClipboard` normalizes the newlines.
- Chrome picks the extension's locale from its UI language, so the context is
  launched with `--lang=en-US`.

The tests load `dist/`, which is what ships. A run against a stale build is the
most likely reason for a failure that makes no sense.

## Debug Mode

`shared/logger.js` is the single source of the flag, and it publishes `debugLog`
and `errorLog` on `window` for every script. `scripts/version-deploy.cjs`
rewrites `const DEBUG_MODE = true` there on a release build and fails if it
cannot find that declaration, so keep it in a shape a plain string replace can
match.

## Data and Storage

One key, `copiedItems` in extension local storage: a map of item id to the epoch
ms of the last copy. `constants/storage-keys.js` is the authority on the name.

Local, not `storage.sync`, on purpose - "have I read this" is a per-device fact
and syncing it would need a conflict story for no gain. Writes prune entries
older than 180 days and cap the map at 5000 items, newest first, so a heavy
reader's storage does not grow forever.

## Firefox for Android

Not covered by any automated test. Check a release by hand on a device: the
buttons appear at the phone layout's wider touch size, a copy actually lands on
the clipboard, and the marks survive a restart.

## Skills

Repository skills live in `.agents/skills/`, which is tracked in git. Claude Code
only discovers skills under `.claude/skills/`, so run `npm run link-skills` once
per clone rather than duplicating the files. Add new skills under
`.agents/skills/<name>/SKILL.md` only.
