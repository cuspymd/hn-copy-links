# AGENTS.md

Guidance for coding agents. Only what the code does not say for itself - the
traps, the reasons, the commands. For structure, read the tree.

"HN Copy Links" puts a copy button next to every Hacker News submission title.
One click writes the article link and the discussion link to the clipboard, for
pasting into an AI chat. Copied rows stay marked, so the list still separates
into read and unread even though the titles were never clicked.
Chrome, Firefox and Firefox for Android.

## Commands

- `npm test` - Jest unit and integration tests (`tests/`)
- `npm run test:e2e` - Playwright (`e2e-tests/`); loads `dist/`, so build first
- `npm run deploy` - Build `dist/` (Chrome) and `dist-firefox/` (Firefox)
- `npm run version-deploy -- <version> chrome|firefox` - Release build and zip into `outputs/`
- `npm run run:firefox-android` - Build and push to a USB-attached phone; see README
- `npm run link-skills` - Link `.claude/skills` to `.agents/skills`; once per clone

Load `dist/` unpacked via `chrome://extensions`, or `dist-firefox/manifest.json`
as a temporary add-on via `about:debugging`.

## Design constraints

- **No background script, no popup, no options page.** The extension asks for
  `storage` and `news.ycombinator.com` and nothing else. Keep it that way: both
  stores review the permission list, and this one needs no explaining.
- **Pure logic goes in a core file**, not in `content.js`: `hn-core.js` (reading
  a row, building URLs and the copied text) and `copied-store-core.js` (the
  copied-items map). Each is an IIFE publishing one `window` namespace. Core
  files are importable, so tests reach them and coverage counts them;
  `content.js` has to be evaluated and reports 0% either way.
- A new script must be added to `content_scripts[0].js` in **both** manifests,
  before whatever reads it. `tests/packaging.test.js` fails if the manifests
  drift apart or a listed file is missing.

## Traps

- **The discussion link is built, not found.** `buildCommentsUrl` composes
  `item?id=<row id>` from the row's id. Reading the "N comments" anchor instead
  breaks on a submission with no comments, where it reads "discuss". An E2E test
  covers that row.
- **The article link resolves against `document.baseURI`**, not
  `location.href`. That is what the browser resolves the title link against, and
  it lets the jsdom tests stand in for a page served from Hacker News.
- **Text posts** point their title at their own item page, so `parseRow` reports
  `isSelfPost` and `buildCopyText` emits one line instead of two. The same URL
  under two labels would say the two are different when they are not.
- **The copied text is not localized.** The `Article:` and `HN discussion:`
  labels are constants in `hn-core.js`: that text is pasted into an AI chat,
  where English reads best whatever the UI language is.
- **A failed copy must not mark the row.** Marking a row whose text never
  reached the clipboard makes the user skip an article they never read.
- **Both clipboard paths need a user gesture.** `shared/clipboard.js` falls back
  from `navigator.clipboard.writeText` to a hidden textarea for Firefox for
  Android. Do not move a copy onto a timer or a message handler.
- **Double injection.** `content.js` calls `window.hnCopyLinks?.dispose()`
  before it starts and publishes its own `dispose`. Otherwise a second injection
  leaves the first instance's observer decorating rows from a stale map. The
  unit suite relies on this between tests.
- **Never pass a callback to an async extension API.** On Firefox a callback in
  a trailing options slot is never called, so the code goes silently dead;
  `mocks/chrome.js` throws on one. The E2E suite is Chromium only, so a green
  run says nothing about Firefox.

## Tests

`content.js` is not importable. `tests/helpers/content-script.js` loads it the
way the manifest does and waits for its init; `submissionRow()` there builds a
row in the shape Hacker News serves, subtext and spacer rows included.

The content script only matches `news.ycombinator.com`, so E2E routes that
origin on the browser context and fulfils it from `e2e-tests/news-list.html`, a
trimmed copy of the front page. No network, and a redesign breaks the tests when
the fixture is updated rather than at random. Two platform details live in the
fixtures: Windows returns clipboard text with CRLF, and Chrome takes the
extension's locale from its UI language (`--lang=en-US`). A failure that makes
no sense is usually a stale `dist/`.

## Storage and debug

One key, `copiedItems`: item id to the epoch ms of the last copy, in extension
local storage. `constants/storage-keys.js` owns the name. Local rather than
`storage.sync` on purpose - "have I read this" is per-device and syncing it
would need a conflict story for no gain. Writes drop entries past 180 days and
cap the map at 5000, newest first.

`shared/logger.js` is the single source of the debug flag.
`scripts/version-deploy.cjs` rewrites `const DEBUG_MODE = true` there on a
release build and fails if it cannot find it, so keep that declaration matchable
by a plain string replace.

## Firefox for Android

No automated test covers it. Check a release by hand on a device: the buttons
appear at the phone layout's larger touch size, a copy reaches the clipboard,
and the marks survive a restart.

## Skills

Skills live in `.agents/skills/`, which git tracks. Claude Code only discovers
`.claude/skills/`, so run `npm run link-skills` rather than duplicating files.
