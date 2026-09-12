# Chrome Web Store submission

Everything the console asks for, ready to paste. The console cannot be
automated: Chrome blocks extension scripting on the web store's own domain, so
this is a manual pass through the form.

Package: `outputs/hn-copy-links-<version>-chrome.zip` (build it with
`npm run version-deploy -- <version> chrome`).

## Store listing

**Item name** (max 75)

```
HN Copy Links
```

**Short description** (max 132) - comes from the package's `_locales`, so the
console fills it in and localizes it. The English value is:

```
Copy a Hacker News article link and its discussion link in one click, and keep track of the stories you already copied.
```

**Description** - the long text in `store-descriptions-en.txt`. The console has
a language selector; the Korean text in `store-descriptions-ko.txt` goes under
한국어, which the package's `_locales/ko` makes available.

**Category**: News & Weather. (Tools is the second-best fit. Productivity is
not a Chrome Web Store category, whatever the older notes said.)

**Language**: English, with Korean added from the language selector.

## Graphic assets

| Asset | Size | File |
| --- | --- | --- |
| Icon | 128x128 | `images/icon128.png` |
| Screenshots | 1280x800 | `store-assets/01-front-page.png`, `02-buttons-closeup.png`, `03-phone.png` |

Screenshot captions are in the `SCREENSHOT CAPTIONS` section of the description
files. A 440x280 promo tile is optional and there is none yet.

## Privacy practices

This is the section that stalls submissions. All four answers:

**Single purpose**

```
The extension adds a copy button to each Hacker News submission row. The button copies the story's article link and its Hacker News discussion link to the clipboard, and marks rows that were already copied.
```

**Justification for `storage`**

```
Stores the ids of stories the user has copied, so rows already copied can be marked. The list stays in the browser's local extension storage on that device and is never transmitted.
```

**Justification for the `news.ycombinator.com` host permission**

```
The content script reads submission rows on Hacker News to build the two links and to insert the copy button. Hacker News is the only site the extension runs on.
```

**Data usage certification**

Certify that no user data is collected. Nothing is transmitted anywhere, there
is no analytics and no remote code. A privacy policy URL is therefore not
required; the repository README covers what is stored locally.

## After submitting

Review usually takes a few days. The listing goes live automatically on
approval unless deferred publishing is chosen.
