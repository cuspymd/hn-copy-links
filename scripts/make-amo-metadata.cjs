#!/usr/bin/env node
// Builds store-assets/amo-metadata.json from the store description files, so
// the listing text has one source. `web-ext sign --channel listed` needs this
// file the first time an add-on is submitted; see README.
//
//   node scripts/make-amo-metadata.cjs

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'store-assets', 'amo-metadata.json');

// AMO locale code per description file.
const LOCALES = { en: 'en-US', ko: 'ko' };
const HOMEPAGE = 'https://github.com/cuspymd/hn-copy-links';

/** Splits a description file into its `=== HEADING ===` sections. */
function readSections(locale) {
  const file = path.join(root, 'arch-docs', 'etc', `store-descriptions-${locale}.txt`);
  const sections = {};
  let heading = null;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^=== (.+) ===$/);
    if (match) {
      heading = match[1];
      sections[heading] = [];
    } else if (heading) {
      sections[heading].push(line);
    }
  }

  return Object.fromEntries(
    Object.entries(sections).map(([name, lines]) => [name, lines.join('\n').trim()])
  );
}

/** The headings carry their own character limits, so match on the prefix. */
function section(sections, prefix) {
  const found = Object.keys(sections).find((name) => name.startsWith(prefix));
  if (!found) throw new Error(`No "${prefix}" section found`);
  return sections[found];
}

const summary = {};
const description = {};

for (const [file, locale] of Object.entries(LOCALES)) {
  const sections = readSections(file);
  summary[locale] = section(sections, 'SUMMARY');
  description[locale] = section(sections, 'DESCRIPTION');

  if (summary[locale].length > 250) {
    console.error(`${locale} summary is ${summary[locale].length} characters; AMO allows 250.`);
    process.exit(1);
  }
}

const metadata = {
  // An object keyed by application, and the version declares Android support,
  // so both have to be here.
  categories: {
    firefox: ['feeds-news-blogging'],
    android: ['feeds-news-blogging'],
  },
  default_locale: 'en-US',
  name: { 'en-US': 'HN Copy Links' },
  summary,
  description,
  homepage: { 'en-US': HOMEPAGE },
  support_url: { 'en-US': `${HOMEPAGE}/issues` },
  license: 'MIT',
  is_experimental: false,
  requires_payment: false,
  // AMO tags come from a fixed vocabulary (/api/v5/addons/tags/) and none of
  // them fit a Hacker News reading tool, so the listing carries none.
  tags: [],
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(metadata, null, 2) + '\n');
console.log(`Wrote ${path.relative(root, outFile)}`);
