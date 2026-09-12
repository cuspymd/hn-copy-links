#!/usr/bin/env node
// Generates images/icon{16,48,128}.png: the Hacker News orange square with a
// white clipboard glyph. Written by hand with zlib so the repository needs no
// image toolchain; run it again only if the mark changes.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ORANGE = [255, 102, 0];
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Glyph geometry in fractions of the icon, so every size draws the same mark.
function pixelColor(x, y, size) {
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;

  const inRect = (x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
  const onRectEdge = (x0, y0, x1, y1, t) =>
    inRect(x0, y0, x1, y1) && !inRect(x0 + t, y0 + t, x1 - t, y1 - t);

  const t = 0.055;

  // Back sheet: an outlined rectangle, offset up and left.
  if (onRectEdge(0.16, 0.2, 0.62, 0.76, t)) return WHITE;
  // Front sheet: filled, offset down and right, with its own gap from the back.
  if (inRect(0.36, 0.3, 0.84, 0.86)) {
    if (inRect(0.36 - t, 0.3 - t, 0.84, 0.86) && !inRect(0.36, 0.3, 0.84, 0.86)) return ORANGE;
    return WHITE;
  }
  if (onRectEdge(0.36 - t, 0.3 - t, 0.84 + t, 0.86 + t, t)) return ORANGE;

  return ORANGE;
}

function renderPng(size) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelColor(x, y, size);
      const at = y * stride + 1 + x * 3;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const imagesDir = path.join(path.resolve(__dirname, '..'), 'images');
fs.mkdirSync(imagesDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const file = path.join(imagesDir, `icon${size}.png`);
  fs.writeFileSync(file, renderPng(size));
  console.log(`Wrote images/icon${size}.png`);
}
