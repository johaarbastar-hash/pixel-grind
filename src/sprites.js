// Palette, sprites and background layers. Everything is pre-rendered once into
// small canvases; nothing is scaled or rotated at draw time (except the
// shop's 2x preview of the skater).

import { createRng } from './rng.js';
import { lookFor, DEFAULT_GEAR } from './gear.js';

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

// A rect's colour is a palette colour, or a role name ('shirt', 'deck'...)
// looked up in `look`, which can give a colour or a two-colour pattern.
function fillRects(g, rects, look) {
  for (const [col, x, y, w, h] of rects) {
    const c = look && col in look ? look[col] : col;
    if (typeof c === 'string') {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    } else {
      fillPattern(g, c, x, y, w, h);
    }
  }
}

// Two-colour pattern ({ a, b, kind: 'rows' | 'cols' | 'check' }), fixed to the
// sprite's pixel grid so neighbouring rects line up.
function fillPattern(g, p, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const odd = p.kind === 'rows' ? yy & 1 : p.kind === 'cols' ? xx & 1 : (xx + yy) & 1;
      g.fillStyle = odd ? p.b : p.a;
      g.fillRect(xx, yy, 1, 1);
    }
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

function sprite(w, h, body, extra, look) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  fillRects(g, body, look);
  addOutline(g, w, h, COL.ink);
  if (extra) fillRects(g, extra, look);
  return c;
}

// --- Skater (16 x 24, facing right, feet on the bottom row) -----------------
// Gear colours are roles in the rect lists: 'hat', 'hatB', 'shirt', 'pants',
// 'deck' (board underside) and 'wheel'. They are filled from the worn gear
// (gear.js) when the sprites are built, so changing gear rebuilds them.

const HEAD_BASE = [
  [COL.skin, 6, 3, 4, 4], // head
  [COL.brown, 6, 3, 1, 2], // hair
  [COL.ink, 9, 4, 1, 1], // eye
  [COL.skin, 7, 7, 2, 1], // neck
];

// Hat designs, drawn over the head. 'hair' is no hat ('hat' = hair colour).
const HATS = {
  cap: [['hat', 6, 1, 4, 2], ['hat', 10, 2, 2, 1]],
  backcap: [['hat', 6, 1, 4, 2], ['hat', 4, 2, 2, 1]],
  hair: [['hat', 7, 1, 2, 1], ['hat', 6, 2, 4, 1]],
  beanie: [['hatB', 7, 0, 2, 1], ['hat', 6, 1, 4, 1], ['hatB', 6, 2, 4, 1]],
  helmet: [['hat', 6, 0, 4, 1], ['hat', 5, 1, 6, 2], ['hat', 5, 3, 1, 2], ['hatB', 5, 2, 6, 1]],
  phones: [
    [COL.brown, 7, 1, 2, 1], // hair
    [COL.brown, 6, 2, 4, 1],
    ['hatB', 6, 0, 4, 1], // band
    ['hatB', 6, 1, 1, 2],
    ['hat', 6, 3, 2, 3], // ear cup
  ],
  crown: [['hat', 5, 0, 1, 1], ['hat', 7, 0, 1, 1], ['hat', 9, 0, 1, 1], ['hat', 5, 1, 5, 2], ['hatB', 7, 1, 1, 1]],
};

const TORSO = [
  ['shirt', 5, 8, 6, 6],
  ['pants', 5, 14, 6, 2], // hips
];

const ARMS_DOWN = [
  ['shirt', 4, 8, 1, 2],
  [COL.skin, 3, 10, 1, 2],
  ['shirt', 11, 8, 1, 2],
  [COL.skin, 12, 10, 1, 2],
];

const ARMS_UP = [
  ['shirt', 4, 8, 1, 1],
  [COL.skin, 3, 6, 1, 2],
  ['shirt', 11, 8, 1, 1],
  [COL.skin, 12, 6, 1, 2],
];

const LEGS = [
  ['pants', 5, 16, 2, 2], // back leg
  ['pants', 4, 18, 2, 2],
  ['pants', 9, 16, 2, 2], // front leg
  ['pants', 10, 18, 2, 2],
  [COL.white, 3, 20, 3, 1], // shoes
  [COL.white, 10, 20, 3, 1],
];

// Knees pulled up while the board flips underneath.
const TUCK_LEGS = [
  ['pants', 4, 15, 3, 2],
  ['pants', 9, 15, 3, 2],
  [COL.white, 3, 17, 3, 1],
  [COL.white, 10, 17, 3, 1],
];

// Board frames, rows 20-23 of the 16 x 24 skater sprite. Dark grip on top,
// bright underside, so flips read at this size.
function boardFlat(wheelA = 'wheel', wheelB = 'wheel') {
  return [
    [COL.ink, 0, 20, 1, 1], // tail kick
    [COL.ink, 15, 20, 1, 1], // nose kick
    [COL.ink, 1, 21, 14, 1], // grip
    ['deck', 1, 22, 14, 1], // underside
    [wheelA, 3, 23, 1, 1],
    [wheelB, 4, 23, 1, 1],
    [wheelA, 11, 23, 1, 1],
    [wheelB, 12, 23, 1, 1],
  ];
}

const BOARD = {
  flat: boardFlat(),
  upsideDown: [
    ['wheel', 3, 20, 2, 1],
    ['wheel', 11, 20, 2, 1],
    ['deck', 1, 21, 14, 1],
    [COL.ink, 1, 22, 14, 1],
    [COL.ink, 0, 23, 1, 1],
    [COL.ink, 15, 23, 1, 1],
  ],
  // On its edge, showing the underside / the grip (barrel roll).
  edgeUnder: [
    ['deck', 1, 20, 14, 3],
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
    ['deck', 5, 22, 6, 1],
    ['wheel', 6, 23, 1, 1],
    ['wheel', 9, 23, 1, 1],
  ],
  end: [
    [COL.ink, 6, 21, 4, 1],
    ['deck', 6, 22, 4, 1],
    ['wheel', 6, 23, 1, 1],
    ['wheel', 9, 23, 1, 1],
  ],
  endUpsideDown: [
    ['wheel', 6, 20, 1, 1],
    ['wheel', 9, 20, 1, 1],
    ['deck', 6, 21, 4, 1],
    [COL.ink, 6, 22, 4, 1],
  ],
  halfEdgeUnder: [
    ['deck', 5, 20, 6, 3],
    [COL.steel, 6, 21, 1, 1],
    [COL.steel, 9, 21, 1, 1],
  ],
  halfEdgeGrip: [
    [COL.ink, 5, 20, 6, 3],
    [COL.slate, 6, 21, 4, 1],
  ],
};

// Moves a list of rects.
const shift = (rects, dx, dy) => rects.map(([c, x, y, w, h]) => [c, x + dx, y + dy, w, h]);

// Board with the nose popped up (ollie snap).
const BOARD_POP = [
  [COL.ink, 0, 22, 1, 1],
  [COL.ink, 1, 22, 5, 1],
  ['deck', 1, 23, 5, 1],
  [COL.ink, 6, 21, 5, 1],
  ['deck', 6, 22, 5, 1],
  [COL.ink, 11, 20, 4, 1],
  ['deck', 11, 21, 4, 1],
  [COL.ink, 15, 19, 1, 1],
];

// Back foot pushing off the ground beside the board: [leg x, foot x, foot row].
const PUSH_STEPS = [
  [5, 4, 21],
  [4, 2, 23],
  [3, 1, 23],
  [4, 3, 21],
];

// Flip animations: board frames under tucked knees.
const FLIP_FRAMES = {
  kickflip: ['flat', 'edgeUnder', 'upsideDown', 'edgeGrip', 'flat'],
  heelflip: ['flat', 'edgeGrip', 'upsideDown', 'edgeUnder', 'flat'],
  shoveit: ['half', 'end', 'half', 'flat'],
  treflip: ['half', 'halfEdgeUnder', 'endUpsideDown', 'halfEdgeGrip', 'half', 'flat'],
};

// Gear colour names (gear.js lookFor) -> palette colours and patterns.
function resolveLook(names) {
  const col = (v) => (typeof v === 'string' ? COL[v] : { kind: v.kind, a: COL[v.a], b: COL[v.b] });
  const look = { hatDesign: HATS[names.hatDesign] ? names.hatDesign : 'cap' };
  for (const role of ['hat', 'hatB', 'shirt', 'pants', 'deck', 'wheel']) look[role] = col(names[role]);
  return look;
}

// Every skater frame, in the given gear (gear.js lookFor).
export function buildSkater(names) {
  const look = resolveLook(names);
  const spr = (w, h, body, extra) => sprite(w, h, body, extra, look);
  const head = [...HEAD_BASE, ...HATS[look.hatDesign]];
  const body = [...head, ...TORSO, ...ARMS_DOWN, ...LEGS];
  const tuck = [...head, ...TORSO, ...ARMS_UP, ...TUCK_LEGS];
  const flips = {};
  for (const trick of Object.keys(FLIP_FRAMES)) {
    flips[trick] = FLIP_FRAMES[trick].map((f) => spr(16, 24, tuck, BOARD[f]));
  }
  return {
    ride: [spr(16, 24, body, boardFlat('wheel', COL.steel)), spr(16, 24, body, boardFlat(COL.steel, 'wheel'))],
    // Trucks on the rail with sparks.
    grind: [
      spr(16, 24, body, [...BOARD.flat.slice(0, 4), [COL.gold, 3, 23, 1, 1], [COL.white, 12, 23, 1, 1]]),
      spr(16, 24, body, [...BOARD.flat.slice(0, 4), [COL.white, 4, 23, 1, 1], [COL.gold, 11, 23, 1, 1]]),
    ],
    air: spr(16, 24, [...head, ...TORSO, ...ARMS_UP, ...LEGS], BOARD.flat),
    flips,
    // Kick-push: leaning in, back foot to the ground and back.
    push: PUSH_STEPS.map(([legX, footX, footY]) =>
      spr(16, 24, [...shift([...head, ...TORSO, ...ARMS_DOWN], 1, 0), ...LEGS.slice(2, 4), LEGS[5]], [
        ...BOARD.flat,
        ['pants', legX, 16, 2, footY - 16],
        [COL.white, footX, footY, 3, 1],
      ]),
    ),
    // Ollie snap: tail down, nose up, front knee up.
    pop: spr(
      16,
      24,
      [...shift([...head, ...TORSO, ...ARMS_UP], 0, -1), ['pants', 5, 15, 2, 4], ['pants', 9, 15, 3, 2], [COL.white, 3, 19, 3, 1], [COL.white, 10, 17, 3, 1]],
      BOARD_POP,
    ),
    // Landing squash: knees bent, body 2 px lower.
    squash: spr(
      16,
      24,
      [...shift([...head, ...TORSO, ...ARMS_DOWN], 0, 2), ['pants', 4, 18, 3, 2], ['pants', 9, 18, 3, 2], [COL.white, 3, 20, 3, 1], [COL.white, 10, 20, 3, 1]],
      BOARD.flat,
    ),
    // Getting back up after a bail: crouched, then squash, then riding.
    getUp: spr(
      16,
      24,
      [...shift([...head, ...TORSO, ...ARMS_DOWN], 1, 5), ['pants', 4, 20, 8, 1], [COL.white, 3, 20, 2, 1], [COL.white, 11, 20, 2, 1]],
      BOARD.flat,
    ),
    // Tumbling: thrown back, then flat in the air (24 x 16, bottom on the
    // ground). Any hat is drawn as a block of its main colour.
    tumble: [
      spr(24, 16, [
        ['hat', 3, 3, 2, 4],
        [COL.skin, 5, 3, 4, 4], // head
        ['shirt', 8, 5, 6, 5],
        [COL.skin, 6, 9, 2, 3], // arm flung down
        ['pants', 13, 4, 4, 4], // legs up
        ['pants', 16, 1, 3, 4],
        [COL.white, 18, 0, 3, 2], // shoes
      ]),
      spr(24, 16, [
        [COL.white, 1, 7, 1, 3],
        ['pants', 2, 7, 6, 3],
        ['shirt', 8, 6, 7, 4],
        [COL.skin, 10, 3, 3, 3], // arm up
        [COL.skin, 15, 6, 4, 4],
        ['hat', 19, 6, 2, 4],
      ]),
    ],
    // Lying on the ground after a bail (24 x 10, bottom row on the ground).
    bail: spr(24, 10, [
      [COL.white, 1, 5, 1, 3], // shoes
      ['pants', 2, 5, 6, 3], // legs
      ['shirt', 8, 4, 7, 4],
      [COL.skin, 10, 8, 4, 1], // arm
      [COL.skin, 15, 4, 4, 4], // head
      ['hat', 19, 4, 2, 4],
      [COL.ink, 17, 5, 1, 1], // eye
    ]),
    // Upside-down board skidding away (16 x 4).
    boardFlipped: (() => {
      const c = makeCanvas(16, 4);
      fillRects(
        c.getContext('2d'),
        [
          ['wheel', 3, 0, 2, 1],
          ['wheel', 11, 0, 2, 1],
          ['deck', 1, 1, 14, 1],
          [COL.ink, 1, 2, 14, 1],
          [COL.ink, 0, 3, 1, 1],
          [COL.ink, 15, 3, 1, 1],
        ],
        look,
      );
      return c;
    })(),
  };
}

// One frame for a shop tile: riding, or (for boards) mid-kickflip with the
// board's underside showing.
export function buildSkaterTile(names, showBoard) {
  const look = resolveLook(names);
  const head = [...HEAD_BASE, ...HATS[look.hatDesign]];
  if (showBoard) return sprite(16, 24, [...head, ...TORSO, ...ARMS_UP, ...TUCK_LEGS], BOARD.edgeUnder, look);
  return sprite(16, 24, [...head, ...TORSO, ...ARMS_DOWN, ...LEGS], BOARD.flat, look);
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
// Sunset to night in 4 palette phases, swapped whole (no continuous tinting,
// which would break the 16-colour look). Each layer is pre-rendered once per
// phase and tiled.

export const PHASES = [
  {
    name: 'sunset',
    bands: [COL.navy, COL.indigo, COL.purple, COL.magenta, COL.rose, COL.orange],
    sun: { y: 112, top: COL.gold, bottom: COL.orange },
    stars: 0,
    windows: 0.12,
    lamps: false,
  },
  {
    name: 'dusk',
    bands: [COL.navy, COL.indigo, COL.purple, COL.purple, COL.magenta, COL.rose],
    sun: { y: 134, top: COL.orange, bottom: COL.rose },
    stars: 10,
    windows: 0.2,
    lamps: true,
  },
  {
    name: 'twilight',
    bands: [COL.ink, COL.navy, COL.indigo, COL.indigo, COL.purple, COL.magenta],
    sun: null,
    stars: 40,
    windows: 0.28,
    lamps: true,
  },
  {
    name: 'night',
    bands: [COL.ink, COL.ink, COL.navy, COL.navy, COL.indigo, COL.indigo],
    sun: null,
    moon: { x: 70, y: 30, r: 9 },
    stars: 80,
    windows: 0.34,
    lamps: true,
  },
];

// Sky in flat palette bands with dithered seams, plus sun / moon and stars.
function buildSky(w, h, phase) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const bands = phase.bands.map((col, i) => [col, i * 25]);
  bands.forEach(([col, y0], i) => {
    const y1 = i + 1 < bands.length ? bands[i + 1][1] : h;
    g.fillStyle = col;
    g.fillRect(0, y0, w, y1 - y0);
  });
  for (let i = 1; i < bands.length; i++) {
    const [lower, y] = bands[i];
    const upper = bands[i - 1][0];
    if (lower === upper) continue;
    for (let x = 0; x < w; x++) {
      g.fillStyle = lower;
      if ((x & 3) === 0) g.fillRect(x, y - 2, 1, 1);
      if ((x & 1) === 0) g.fillRect(x, y - 1, 1, 1);
      g.fillStyle = upper;
      if ((x & 3) === 2) g.fillRect(x, y, 1, 1);
    }
  }
  // Stars: fixed positions, more as it gets darker.
  const stars = createRng(5);
  for (let i = 0; i < phase.stars; i++) {
    const x = stars.int(0, w - 1);
    const y = stars.int(0, 70);
    g.fillStyle = stars.chance(0.25) ? COL.white : COL.steel;
    g.fillRect(x, y, 1, 1);
  }
  // Sun: striped lower half with widening gaps, sinking phase by phase.
  if (phase.sun) {
    const cx = 244;
    const cy = phase.sun.y;
    const r = 26;
    for (let dy = -r; dy <= r && cy + dy < h; dy++) {
      if (dy > 2 && (dy - 3) % 6 < 1 + Math.floor(dy / 9)) continue;
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      g.fillStyle = dy < 0 ? phase.sun.top : phase.sun.bottom;
      g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
  }
  if (phase.moon) {
    const { x: mx, y: my, r } = phase.moon;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      g.fillStyle = COL.cream;
      g.fillRect(mx - half, my + dy, half * 2 + 1, 1);
    }
    g.fillStyle = COL.steel; // craters
    g.fillRect(mx - 3, my - 2, 2, 2);
    g.fillRect(mx + 2, my + 3, 3, 2);
  }
  return c;
}

// Far skyline silhouettes with lit windows; tiles seamlessly. Same buildings
// in every phase, more windows lit as it gets dark.
function buildSkyline(w, h, phase) {
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
        if (roll < phase.windows) {
          g.fillStyle = roll < 0.03 ? COL.cream : COL.gold;
          g.fillRect(wx, wy, 2, 1);
        }
      }
    }
    x += bw + (rng.chance(0.3) ? rng.int(1, 4) : 0);
  }
  return c;
}

// Mid layer: closer, shorter blocks in ink with bigger lit windows and
// rooftop clutter, with gaps so the far skyline shows through.
function buildMid(w, h, phase) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const rng = createRng(23);
  let x = rng.int(0, 20);
  while (x < w - 10) {
    const bw = Math.min(rng.int(30, 64), w - x);
    const bh = rng.int(18, h - 4);
    const top = h - bh;
    g.fillStyle = COL.ink;
    g.fillRect(x, top, bw, bh);
    g.fillStyle = COL.navy; // roof edge
    g.fillRect(x, top, bw, 1);
    if (rng.chance(0.5)) {
      g.fillStyle = COL.ink; // water tank / AC unit
      const ux = x + rng.int(3, bw - 10);
      g.fillRect(ux, top - 5, 7, 5);
      g.fillRect(ux + 1, top - 7, 5, 2);
    }
    for (let wy = top + 4; wy < h - 6; wy += 6) {
      for (let wx = x + 3; wx < x + bw - 4; wx += 6) {
        const roll = rng.next();
        if (roll < phase.windows * 1.2) {
          g.fillStyle = roll < 0.05 ? COL.cream : COL.gold;
          g.fillRect(wx, wy, 3, 2);
        } else {
          g.fillStyle = COL.navy; // dark window
          g.fillRect(wx, wy, 3, 2);
        }
      }
    }
    x += bw + rng.int(10, 40);
  }
  return c;
}

// Street props on the far edge of the pavement: lamp posts and a low
// chain-link fence (dark and dithered so it never reads as a grind rail).
// Two versions: lamps off and lamps on. Drawn from y = groundY - h + 6.
function buildProps(w, h, lit) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const base = h - 6; // ground line inside the tile
  // Fence: posts and a mesh of dots
  for (let x = 0; x < w; x++) {
    for (let y = base - 9; y < base; y++) {
      if ((x + y) % 3 === 0) {
        g.fillStyle = COL.indigo;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  g.fillStyle = COL.slate;
  g.fillRect(0, base - 10, w, 1);
  for (let x = 0; x < w; x += 16) g.fillRect(x, base - 10, 1, 10);
  // Lamp posts
  for (const lx of [40, 200]) {
    fillRects(g, [
      [COL.slate, lx, base - 44, 2, 44], // pole
      [COL.slate, lx - 1, base - 2, 4, 2], // foot
      [COL.slate, lx + 2, base - 44, 7, 1], // arm
      [lit ? COL.cream : COL.steel, lx + 7, base - 43, 4, 2], // lamp head
    ]);
    if (lit) {
      g.fillStyle = COL.gold; // glow
      g.fillRect(lx + 6, base - 41, 6, 1);
      // Light pool on the pavement, dithered.
      for (let x = lx - 6; x < lx + 24; x++) {
        for (let y = base; y < h; y++) {
          if ((x + y) & 1) continue;
          g.fillStyle = COL.steel;
          g.fillRect(x, y, 1, 1);
        }
      }
    }
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

// Pixel rows to a canvas: each char maps to a colour, '.' is transparent.
function fromRows(rows, colours) {
  const c = makeCanvas(rows[0].length, rows.length);
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = colours[row[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return c;
}

// Spinning coin: 4 frames (face, turning, edge, turning back).
function buildCoin() {
  const colours = { o: COL.orange, g: COL.gold, c: COL.cream };
  const face = ['..oooo..', '.oggggo.', 'oggcgggo', 'oggcgggo', 'oggcgggo', 'oggcgggo', '.oggggo.', '..oooo..'];
  const turnA = ['...oo...', '..oggo..', '.ogcggo.', '.ogcggo.', '.ogcggo.', '.ogcggo.', '..oggo..', '...oo...'];
  const edge = ['...oo...', '...og...', '...og...', '...og...', '...og...', '...og...', '...og...', '...oo...'];
  const turnB = ['...oo...', '..oggo..', '.oggcgo.', '.oggcgo.', '.oggcgo.', '.oggcgo.', '..oggo..', '...oo...'];
  return [face, turnA, edge, turnB].map((rows) => fromRows(rows, colours));
}

// HUD icons: one board per life, and the pause button.
function buildBoardIcon() {
  return fromRows(['c.......c', '.ccccccc.', '.rrrrrrr.', '..s...s..'], { c: COL.cream, r: COL.rose, s: COL.steel });
}

function buildPauseIcon() {
  return fromRows(
    ['sssssssssss', 's.........s', 's..cc.cc..s', 's..cc.cc..s', 's..cc.cc..s', 's..cc.cc..s', 's..cc.cc..s', 's.........s', 'sssssssssss'],
    { s: COL.steel, c: COL.cream, '.': null },
  );
}

// Day phase for a run clock (s): sunset, dusk, twilight, night (stays night).
export function phaseAt(clock, cfg) {
  return Math.min(PHASES.length - 1, Math.floor(clock / cfg.render.phaseTime));
}

// 50% ink checkerboard, used to dim the scene behind menus.
function buildChecker(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = COL.ink;
  for (let y = 0; y < h; y++) for (let x = y & 1; x < w; x += 2) g.fillRect(x, y, 1, 1);
  return c;
}

// gear: worn gear ({ slot: item id }, see gear.js); the skater is rebuilt with
// buildSkater when it changes.
export function buildSprites(cfg, gear = DEFAULT_GEAR) {
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
    skater: buildSkater(lookFor(gear)),
    obstacle,
    coin: buildCoin(),
    boardIcon: buildBoardIcon(),
    pauseIcon: buildPauseIcon(),
    // Per day phase (see PHASES): index with phaseAt().
    sky: PHASES.map((p) => buildSky(cfg.view.maxWidth, groundY, p)),
    skyline: PHASES.map((p) => buildSkyline(512, 80, p)),
    mid: PHASES.map((p) => buildMid(448, 56, p)),
    props: [buildProps(320, 56, false), buildProps(320, 56, true)],
    street: buildStreet(),
    checker: buildChecker(cfg.view.maxWidth, cfg.view.height),
  };
}
