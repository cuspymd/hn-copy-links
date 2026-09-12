# HN Copy Links

A browser extension that puts a copy button beside every Hacker News
submission title. One click writes three lines to the clipboard:

```
Rust in the kernel, two years on
Article: https://example.com/rust-in-the-kernel
HN discussion: https://news.ycombinator.com/item?id=41000001
```

Paste that into an AI chat and you get a summary of the article and of what
Hacker News made of it, without hunting for the discussion page yourself.

A text post such as an Ask HN thread has no separate article, so it copies as
two lines.

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

## Permissions

`storage`, and access to `news.ycombinator.com`. Nothing else. The extension
has no background process and sends no data anywhere.

## Development

```bash
npm test                 # unit and integration tests
npm run deploy:chrome    # build what the E2E tests load
npm run test:e2e         # Playwright, against a saved copy of the HN markup
```

`AGENTS.md` has the details worth knowing before changing anything.

## License

MIT
