// Generates the app icons as PNGs from a 32 x 32 pixel-art design, scaled up
// with nearest-neighbour so the pixels stay crisp. No image editor, no
// downloaded art. Run: node scripts/make-icons.mjs  (writes public/icons/)

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// Same palette as src/sprites.js
const C = {
  ink: '#0d0b1a',
  navy: '#1e1e3f',
  indigo: '#33306b',
  purple: '#5d3a8a',
  magenta: '#a8417f',
  rose: '#e0566b',
  orange: '#f58b4c',
  gold: '#ffc857',
  cream: '#fff1d0',
  steel: '#8a95b5',
  slate: '#4b5675',
};

// 32 x 32 design: sunset bands, striped sun, a skateboard mid-flip.
function design() {
  const px = Array.from({ length: 32 }, () => new Array(32).fill(C.ink));
  const set = (x, y, col) => {
    if (x >= 0 && y >= 0 && x < 32 && y < 32) px[y][x] = col;
  };
  const bands = [C.navy, C.indigo, C.purple, C.magenta, C.rose, C.orange];
  for (let y = 0; y < 32; y++) {
    const b = Math.min(bands.length - 1, Math.floor(y / 5.4));
    for (let x = 0; x < 32; x++) set(x, y, bands[b]);
  }
  // Sun, low on the horizon, striped
  for (let dy = -8; dy <= 8; dy++) {
    if (dy > 1 && (dy - 2) % 4 < 1 + Math.floor(dy / 4)) continue;
    const half = Math.floor(Math.sqrt(64 - dy * dy));
    for (let x = 16 - half; x <= 16 + half; x++) set(x, 23 + dy, dy < 0 ? C.gold : C.orange);
  }
  // Skyline strip
  const tops = [27, 25, 28, 24, 26, 28, 25, 27];
  for (let x = 0; x < 32; x++) {
    const top = tops[Math.floor(x / 4)];
    for (let y = top; y < 32; y++) set(x, y, C.navy);
  }
  // The hero: a big skateboard, upside down mid-flip so the bright underside
  // and wheels face the viewer, with an ink outline to pop off the sky.
  const board = Array.from({ length: 32 }, () => new Array(32).fill(null));
  const put = (x, y, col) => (board[y][x] = col);
  // Tilted deck mid-ollie, rising to the right: grip on top, bright edge,
  // trucks and wheels underneath.
  const deckY = (x) => Math.round(18 - ((x - 5) * 10) / 21);
  for (let x = 4; x <= 27; x++) {
    const y = deckY(x);
    put(x, y, C.slate); // grip
    put(x, y + 1, C.gold); // deck
    put(x, y + 2, C.gold);
  }
  for (const tx of [9, 22]) {
    const y = deckY(tx) + 3;
    put(tx, y, C.steel); // truck
    put(tx + 1, y, C.steel);
    for (const wx of [tx - 1, tx + 2]) {
      put(wx, y + 1, C.cream); // wheels
      put(wx, y + 2, C.cream);
    }
  }
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (board[y][x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => board[y + dy] && board[y + dy][x + dx]);
      if (near) set(x, y, C.ink);
    }
  }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (board[y][x]) set(x, y, board[y][x]);
  // Speed lines
  for (const [x, y, w] of [[0, 16, 4], [1, 18, 3], [0, 6, 3]]) for (let i = 0; i < w; i++) set(x + i, y, C.cream);
  return px;
}

function hex(col) {
  const n = parseInt(col.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

// size x size image; the 32-px design drawn at `inner` px, centred on `bg`.
function render(size, inner, bg) {
  const src = design();
  const data = Buffer.alloc(size * size * 4);
  const off = Math.floor((size - inner) / 2);
  const bgc = hex(bg);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ix = x - off;
      const iy = y - off;
      const inside = ix >= 0 && iy >= 0 && ix < inner && iy < inner;
      const col = inside ? hex(src[Math.floor((iy * 32) / inner)][Math.floor((ix * 32) / inner)]) : bgc;
      data.set(col, (y * size + x) * 4);
    }
  }
  return encodePng(size, size, data);
}

// --- Minimal PNG encoder (RGBA, no filtering) --------------------------------

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
const files = {
  'icon-192.png': render(192, 192, C.ink),
  'icon-512.png': render(512, 512, C.ink),
  // Maskable: launchers crop to a circle or squircle; keep the art in the
  // middle 80% (the safe zone) on a matching background.
  'icon-maskable-512.png': render(512, 384, C.ink),
  'apple-touch-icon.png': render(180, 160, C.ink),
};
for (const [name, png] of Object.entries(files)) {
  writeFileSync(path.join(OUT, name), png);
  console.log(`${name}  ${png.length} bytes`);
}
