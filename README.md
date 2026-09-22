# HN Copy Links

A browser extension that puts a copy button beside every Hacker News
submission title. One click writes both links to the clipboard:

```
Article: https://example.com/rust-in-the-kernel
HN discussion: https://news.ycombinator.com/item?id=41000001
```

Paste that into an AI chat and you get a summary of the article and of what
Hacker News made of it, without hunting for the discussion page yourself.

A text post such as an Ask HN thread has no separate article, so it copies as
one line.

## Share on Android

In Firefox for Android there is a share button beside the copy button. It opens
Android's own share menu with both links in it, so you pick ChatGPT, Claude or
any other app there and the links arrive in it - "copy, switch apps, paste"
becomes one tap and one choice. Picking an app marks the row, as a copy does;
closing the menu without a choice does not.

On the desktop the button is not shown: Firefox has no share menu there, and
Chrome's lists the system share targets rather than chat apps.

It is on by default. Turn it off in the extension's settings:

- Chrome: `chrome://extensions` -> HN Copy Links -> Details -> Extension options
- Firefox: `about:addons` -> HN Copy Links -> Preferences

## Already copied

Copying instead of clicking means the title never turns purple, so the button
takes that job over: once used, it becomes a dimmed check mark. The list still
separates into what you have looked at and what you have not.

The record is kept in the browser's extension storage on that device only.
Entries older than 180 days are dropped.

## Install from source

```bash
npm install
npm run deploy
```

- Chrome: `chrome://extensions` -> Developer mode -> Load unpacked -> `dist/`
- Firefox: `about:debugging` -> This Firefox -> Load Temporary Add-on -> `dist-firefox/manifest.json`

### Firefox for Android

Install Firefox Nightly on the phone, turn on **Settings -> Advanced -> Remote
debugging via USB**, and connect it over USB with developer mode enabled. Then,
with the [Android platform tools](https://developer.android.com/tools/releases/platform-tools)
on your `PATH`:

```bash
adb devices
```

That should list the phone as `device`. If it says `unauthorized`, accept the
debugging prompt on the phone. Then:

```bash
npm run run:firefox-android
```

The extension is built and pushed to Firefox Nightly, which restarts with it
installed. Add `-- --adb-device <id>` if more than one device is attached, and
`-- --firefox-apk org.mozilla.firefox` to use release Firefox instead of
Nightly. Leave the command running: it reinstalls the extension whenever
`dist-firefox/` changes, so a rebuild is all a change needs.

## Permissions

`storage`, and access to `news.ycombinator.com`. Nothing else - the share
button uses the browser's own share menu, which needs no permission. The extension
has no background process and sends no data anywhere. [PRIVACY.md](PRIVACY.md)
spells that out.

## Development

```bash
npm test                 # unit and integration tests
npm run deploy:chrome    # build what the E2E tests load
npm run test:e2e         # Playwright, against a saved copy of the HN markup
```

`AGENTS.md` has the details worth knowing before changing anything.

## Store listing

The listing text lives in `arch-docs/etc/store-descriptions-en.txt` and
`-ko.txt`. This rebuilds the screenshots and the AMO metadata from it:

```bash
npm run store-assets
```

Screenshots land in `store-assets/` at 1280x800, captured from the live Hacker
News list, so look at them before using them. Submitting to Firefox Add-ons
needs [an AMO API credential](https://addons.mozilla.org/developers/addon/api/key/)
in the environment:

```bash
WEB_EXT_API_KEY=user:... WEB_EXT_API_SECRET=... npm run submit:firefox
```

That uploads the build and creates the listing with the generated metadata.
Screenshots still have to be attached by hand on AMO, which has no API for
them.

## License

MIT
