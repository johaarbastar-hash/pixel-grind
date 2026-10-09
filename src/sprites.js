// Palette, sprites and background layers. Everything is pre-rendered once into
// small canvases; nothing is scaled or rotated at draw time.
// M1 sprites are placeholders built from rectangles (final art comes in M7).

import { createRng } from './rng.js';

// The one 16-colour palette (city at sunset). Final pick in M7.
export const PALETTE = [
  '#0d0b1a', // 0 ink
  '#1e1e3f', // 1 navy
  '#33306b', // 2 indigo
  '#5d3a8a', // 3 purple
  '#a8417f', // 4 magenta
  '#e0566b', // 5 rose
  '#f58b4c', // 6 orange
  '#ffc857', // 7 gold
  '#fff1d0', // 8 cream
  '#ffffff', // 9 white
  '#2a9d8f', // 10 teal
  '#7fd6b5', // 11 mint
  '#4b5675', // 12 slate
  '#8a95b5', // 13 steel
  '#6e4434', // 14 brown
  '#d08b5b', // 15 skin
];

export const COL = {
  ink: PALETTE[0],
  navy: PALETTE[1],
  indigo: PALETTE[2],
  purple: PALETTE[3],
  magenta: PALETTE[4],
  rose: PALETTE[5],
  orange: PALETTE[6],
  gold: PALETTE[7],
  cream: PALETTE[8],
  white: PALETTE[9],
  teal: PALETTE[10],
  mint: PALETTE[11],
  slate: PALETTE[12],
  steel: PALETTE[13],
  brown: PALETTE[14],
  skin: PALETTE[15],
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function fillRects(g, rects) {
  for (const [col, x, y, w, h] of rects) {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  }
}

// 1 px outline around everything drawn so far.
function addOutline(g, w, h, color) {
  const d = g.getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  g.fillStyle = color;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
        g.fillRect(x, y, 1, 1);
      }
    }
  }
}

function sprite(w, h, body, extra) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  fillRects(g, body);
  addOutline(g, w, h, COL.ink);
  if (extra) fillRects(g, extra);
  return c;
}

// --- Skater (16 x 24, facing right, feet on the bottom row) -----------------

const HEAD = [
  [COL.teal, 6, 1, 4, 2], // cap
  [COL.teal, 10, 2, 2, 1], // brim
  [COL.skin, 6, 3, 4, 4], // head
  [COL.brown, 6, 3, 1, 2], // hair
  [COL.ink, 9, 4, 1, 1], // eye
  [COL.skin, 7, 7, 2, 1], // neck
];

const TORSO = [
  [COL.rose, 5, 8, 6, 6], // shirt
  [COL.indigo, 5, 14, 6, 2], // hips
];

const ARMS_DOWN = [
  [COL.rose, 4, 8, 1, 2],
  [COL.skin, 3, 10, 1, 2],
  [COL.rose, 11, 8, 1, 2],
  [COL.skin, 12, 10, 1, 2],
];

const ARMS_UP = [
  [COL.rose, 4, 8, 1, 1],
  [COL.skin, 3, 6, 1, 2],
  [COL.rose, 11, 8, 1, 1],
  [COL.skin, 12, 6, 1, 2],
];

const LEGS = [
  [COL.indigo, 5, 16, 2, 2], // back leg
  [COL.indigo, 4, 18, 2, 2],
  [COL.indigo, 9, 16, 2, 2], // front leg
  [COL.indigo, 10, 18, 2, 2],
  [COL.white, 3, 20, 3, 1], // shoes
  [COL.white, 10, 20, 3, 1],
];

// Knees pulled up while the board flips underneath.
const TUCK_LEGS = [
  [COL.indigo, 4, 15, 3, 2],
  [COL.indigo, 9, 15, 3, 2],
  [COL.white, 3, 17, 3, 1],
  [COL.white, 10, 17, 3, 1],
];

// Board frames, rows 20-23 of the 16 x 24 skater sprite. Dark grip on top,
// bright underside, so flips read at this size.
function boardFlat(wheelA = COL.cream, wheelB = COL.cream) {
  return [
    [COL.ink, 0, 20, 1, 1], // tail kick
    [COL.ink, 15, 20, 1, 1], // nose kick
    [COL.ink, 1, 21, 14, 1], // grip
    [COL.gold, 1, 22, 14, 1], // underside
    [wheelA, 3, 23, 1, 1],
    [wheelB, 4, 23, 1, 1],
    [wheelA, 11, 23, 1, 1],
    [wheelB, 12, 23, 1, 1],
  ];
}

const BOARD = {
  flat: boardFlat(),
  upsideDown: [
    [COL.cream, 3, 20, 2, 1],
    [COL.cream, 11, 20, 2, 1],
    [COL.gold, 1, 21, 14, 1],
    [COL.ink, 1, 22, 14, 1],
    [COL.ink, 0, 23, 1, 1],
    [COL.ink, 15, 23, 1, 1],
  ],
  // On its edge, showing the underside / the grip (barrel roll).
  edgeUnder: [
    [COL.gold, 1, 20, 14, 3],
    [COL.steel, 3, 21, 2, 1],
    [COL.steel, 11, 21, 2, 1],
  ],
  edgeGrip: [
    [COL.ink, 1, 20, 14, 3],
    [COL.slate, 2, 21, 12, 1],
  ],
  // Turned 45 / 90 degrees (shove-it spin), seen from the side.
  half: [
    [COL.ink, 4, 20, 1, 1],
    [COL.ink, 11, 20, 1, 1],
    [COL.ink, 5, 21, 6, 1],
    [COL.gold, 5, 22, 6, 1],
    [COL.cream, 6, 23, 1, 1],
    [COL.cream, 9, 23, 1, 1],
  ],
  end: [
    [COL.ink, 6, 21, 4, 1],
    [COL.gold, 6, 22, 4, 1],
    [COL.cream, 6, 23, 1, 1],
    [COL.cream, 9, 23, 1, 1],
  ],
  endUpsideDown: [
    [COL.cream, 6, 20, 1, 1],
    [COL.cream, 9, 20, 1, 1],
    [COL.gold, 6, 21, 4, 1],
    [COL.ink, 6, 22, 4, 1],
  ],
  halfEdgeUnder: [
    [COL.gold, 5, 20, 6, 3],
    [COL.steel, 6, 21, 1, 1],
    [COL.steel, 9, 21, 1, 1],
  ],
  halfEdgeGrip: [
    [COL.ink, 5, 20, 6, 3],
    [COL.slate, 6, 21, 4, 1],
  ],
};

// Placeholder flip animations (final frames in M7).
const FLIP_FRAMES = {
  kickflip: ['flat', 'edgeUnder', 'upsideDown', 'edgeGrip', 'flat'],
  heelflip: ['flat', 'edgeGrip', 'upsideDown', 'edgeUnder', 'flat'],
  shoveit: ['half', 'end', 'half', 'flat'],
  treflip: ['half', 'halfEdgeUnder', 'endUpsideDown', 'halfEdgeGrip', 'half', 'flat'],
};

function buildSkater() {
  const body = [...HEAD, ...TORSO, ...ARMS_DOWN, ...LEGS];
  const tuck = [...HEAD, ...TORSO, ...ARMS_UP, ...TUCK_LEGS];
  const flips = {};
  for (const trick of Object.keys(FLIP_FRAMES)) {
    flips[trick] = FLIP_FRAMES[trick].map((f) => sprite(16, 24, tuck, BOARD[f]));
  }
  return {
    ride: [
      sprite(16, 24, body, boardFlat(COL.cream, COL.steel)),
      sprite(16, 24, body, boardFlat(COL.steel, COL.cream)),
    ],
    // Trucks on the rail with sparks (particles come in M7).
    grind: [
      sprite(16, 24, body, [...BOARD.flat.slice(0, 4), [COL.gold, 3, 23, 1, 1], [COL.white, 12, 23, 1, 1]]),
      sprite(16, 24, body, [...BOARD.flat.slice(0, 4), [COL.white, 4, 23, 1, 1], [COL.gold, 11, 23, 1, 1]]),
    ],
    air: sprite(16, 24, [...HEAD, ...TORSO, ...ARMS_UP, ...LEGS], BOARD.flat),
    flips,
    // Lying on the ground after a bail (24 x 10, bottom row on the ground).
    bail: sprite(24, 10, [
      [COL.white, 1, 5, 1, 3], // shoes
      [COL.indigo, 2, 5, 6, 3], // legs
      [COL.rose, 8, 4, 7, 4], // shirt
      [COL.skin, 10, 8, 4, 1], // arm
      [COL.skin, 15, 4, 4, 4], // head
      [COL.teal, 19, 4, 2, 4], // cap
      [COL.ink, 17, 5, 1, 1], // eye
    ]),
    // Upside-down board skidding away (16 x 4).
    boardFlipped: (() => {
      const c = makeCanvas(16, 4);
      fillRects(c.getContext('2d'), [
        [COL.cream, 3, 0, 2, 1],
        [COL.cream, 11, 0, 2, 1],
        [COL.gold, 1, 1, 14, 1],
        [COL.ink, 1, 2, 14, 1],
        [COL.ink, 0, 3, 1, 1],
        [COL.ink, 15, 3, 1, 1],
      ]);
      return c;
    })(),
  };
}

// --- Obstacles (city skins) ------------------------------------------------
// One skin per gameplay type: cone = low block, trash can = tall block,
// concrete ledge = ledge, handrail = rail, open hole = gap, wooden ramp = kicker.

function buildCan() {
  const c = makeCanvas(12, 16);
  fillRects(c.getContext('2d'), [
    [COL.ink, 4, 0, 4, 1], // handle
    [COL.mint, 0, 1, 12, 1], // lid
    [COL.teal, 0, 2, 12, 1],
    [COL.teal, 1, 3, 10, 12], // body
    [COL.mint, 3, 4, 1, 10], // ribs
    [COL.mint, 6, 4, 1, 10],
    [COL.slate, 9, 3, 2, 12], // shade
    [COL.ink, 1, 15, 10, 1], // base
  ]);
  return c;
}

function buildKicker(cfg) {
  const { w, h } = cfg.obstacles.kicker;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  for (let x = 0; x < w; x++) {
    const colH = Math.ceil((h * (x + 1)) / w);
    g.fillStyle = COL.brown;
    g.fillRect(x, h - colH, 1, colH);
    g.fillStyle = COL.gold; // riding surface
    g.fillRect(x, h - colH, 1, 1);
  }
  fillRects(g, [
    [COL.steel, w - 3, 0, 3, 1], // metal lip
    [COL.ink, w - 1, 1, 1, h - 1], // back
  ]);
  return c;
}

function buildLedge(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  fillRects(g, [
    [COL.steel, 0, 0, w, h], // concrete
    [COL.cream, 0, 0, w, 1], // grindable edge
    [COL.slate, 0, h - 2, w, 2], // shadowed base
    [COL.slate, w - 1, 1, 1, h - 1],
  ]);
  g.fillStyle = COL.slate; // slab seams
  for (let x = 16; x < w - 4; x += 16) g.fillRect(x, 2, 1, h - 4);
  return c;
}

function buildRail(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const posts = [2, w - 4];
  for (let x = 40; x < w - 20; x += 40) posts.push(x);
  for (const x of posts) {
    fillRects(g, [
      [COL.steel, x, 2, 2, h - 3],
      [COL.slate, x + 1, 2, 1, h - 3],
      [COL.slate, x - 1, h - 1, 4, 1], // foot
    ]);
  }
  fillRects(g, [
    [COL.cream, 0, 0, w, 1], // bar top: the grind surface
    [COL.steel, 0, 1, w, 1],
  ]);
  return c;
}

// Open hole in the pavement, drawn from the riding surface down.
function buildGap(w) {
  const c = makeCanvas(w, 10);
  fillRects(c.getContext('2d'), [
    [COL.ink, 0, 0, w, 10],
    [COL.navy, w - 2, 1, 2, 9], // far wall catches some light
    [COL.navy, 0, 9, w, 1],
  ]);
  return c;
}

function buildCone() {
  const c = makeCanvas(8, 8);
  fillRects(c.getContext('2d'), [
    [COL.orange, 3, 0, 2, 2],
    [COL.white, 2, 2, 4, 1],
    [COL.orange, 2, 3, 4, 1],
    [COL.orange, 1, 4, 6, 1],
    [COL.white, 1, 5, 6, 1],
    [COL.orange, 1, 6, 6, 1],
    [COL.rose, 4, 1, 1, 1], // shading on the right
    [COL.rose, 5, 3, 1, 1],
    [COL.rose, 6, 4, 1, 1],
    [COL.rose, 6, 6, 1, 1],
    [COL.magenta, 0, 7, 8, 1], // base
  ]);
  return c;
}

// --- Background layers -----------------------------------------------------

// Sunset sky in flat palette bands with dithered seams, plus a striped sun.
function buildSky(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const bands = [
    [COL.navy, 0],
    [COL.indigo, 25],
    [COL.purple, 50],
    [COL.magenta, 75],
    [COL.rose, 100],
    [COL.orange, 125],
  ];
  bands.forEach(([col, y0], i) => {
    const y1 = i + 1 < bands.length ? bands[i + 1][1] : h;
    g.fillStyle = col;
    g.fillRect(0, y0, w, y1 - y0);
  });
  for (let i = 1; i < bands.length; i++) {
    const [lower, y] = bands[i];
    const upper = bands[i - 1][0];
    for (let x = 0; x < w; x++) {
      g.fillStyle = lower;
      if ((x & 3) === 0) g.fillRect(x, y - 2, 1, 1);
      if ((x & 1) === 0) g.fillRect(x, y - 1, 1, 1);
      g.fillStyle = upper;
      if ((x & 3) === 2) g.fillRect(x, y, 1, 1);
    }
  }
  // Sun: gold top, orange lower half with widening gaps.
  const cx = 244;
  const cy = 112;
  const r = 26;
  for (let dy = -r; dy <= r; dy++) {
    if (dy > 2 && (dy - 3) % 6 < 1 + Math.floor(dy / 9)) continue;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillStyle = dy < 0 ? COL.gold : COL.orange;
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
  return c;
}

// Far skyline silhouettes with lit windows; tiles seamlessly.
function buildSkyline(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const rng = createRng(7);
  let x = 0;
  while (x < w) {
    const bw = Math.min(rng.int(14, 40), w - x);
    const bh = rng.int(18, h - 6);
    const top = h - bh;
    g.fillStyle = COL.navy;
    g.fillRect(x, top, bw, bh);
    if (bw > 12 && rng.chance(0.35)) g.fillRect(x + rng.int(2, bw - 9), top - 3, 6, 3);
    if (rng.chance(0.2)) g.fillRect(x + rng.int(1, bw - 2), top - rng.int(5, 10), 1, 10);
    for (let wy = top + 4; wy < h - 4; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 3; wx += 4) {
        const roll = rng.next();
        if (roll < 0.14) {
          g.fillStyle = roll < 0.03 ? COL.cream : COL.gold;
          g.fillRect(wx, wy, 2, 1);
        }
      }
    }
    x += bw + (rng.chance(0.3) ? rng.int(1, 4) : 0);
  }
  return c;
}

// Pavement (the riding surface is its top row), curb and road. 64 px tile.
function buildStreet() {
  const c = makeCanvas(64, 32);
  const g = c.getContext('2d');
  fillRects(g, [
    [COL.slate, 0, 0, 64, 10], // pavement
    [COL.steel, 0, 0, 64, 1], // pavement edge
    [COL.navy, 0, 1, 1, 9], // slab joints
    [COL.navy, 32, 1, 1, 9],
    [COL.steel, 0, 10, 64, 1], // curb top
    [COL.indigo, 0, 11, 64, 2], // curb face
    [COL.navy, 0, 13, 64, 19], // road
    [COL.gold, 4, 22, 24, 1], // lane dash
  ]);
  const rng = createRng(11);
  g.fillStyle = COL.indigo;
  for (let i = 0; i < 10; i++) g.fillRect(rng.int(0, 63), rng.int(2, 9), 1, 1);
  g.fillStyle = COL.ink;
  for (let i = 0; i < 14; i++) g.fillRect(rng.int(0, 63), rng.int(14, 31), 1, 1);
  return c;
}

// 50% ink checkerboard, used to dim the scene behind menus.
function buildChecker(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = COL.ink;
  for (let y = 0; y < h; y++) for (let x = y & 1; x < w; x += 2) g.fillRect(x, y, 1, 1);
  return c;
}

export function buildSprites(cfg) {
  const groundY = cfg.world.groundY;
  const fixed = {
    lowBlock: buildCone(),
    tallBlock: buildCan(),
    kicker: buildKicker(cfg),
  };
  // Ledges, rails and gaps vary in width: built on first use, then cached.
  const cache = new Map();
  function obstacle(ob) {
    if (fixed[ob.type]) return fixed[ob.type];
    const key = ob.type + ':' + ob.w;
    let c = cache.get(key);
    if (!c) {
      if (ob.type === 'ledge') c = buildLedge(ob.w, ob.h);
      else if (ob.type === 'rail') c = buildRail(ob.w, ob.h);
      else c = buildGap(ob.w);
      cache.set(key, c);
    }
    return c;
  }
  return {
    skater: buildSkater(),
    obstacle,
    sky: buildSky(cfg.view.maxWidth, groundY),
    skyline: buildSkyline(512, 80),
    street: buildStreet(),
    checker: buildChecker(cfg.view.maxWidth, cfg.view.height),
  };
}
