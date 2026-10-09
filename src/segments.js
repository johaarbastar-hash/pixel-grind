// Hand-authored obstacle patterns. Each segment has a tier (1-4): it can appear
// from that tier on, so it must be fair at every speed from that tier up.
// Item x is the offset (px) authored at start speed; the spawner stretches
// offsets (and gap widths) by current speed / start speed. Other widths are
// fixed. Gap widths are authored at or under 0.7 x start speed x ollie airtime.
// Every segment must pass the bot soak test (npm run soak) at every tier.

export const SEGMENTS = [
  // Tier 1: one idea at a time.
  { id: 'cone', tier: 1, items: [{ type: 'lowBlock', x: 0 }] },
  { id: 'cone-pair', tier: 1, items: [{ type: 'lowBlock', x: 0 }, { type: 'lowBlock', x: 10 }] },
  { id: 'can', tier: 1, items: [{ type: 'tallBlock', x: 0 }] },
  { id: 'rail-64', tier: 1, items: [{ type: 'rail', x: 0, w: 64 }] },
  { id: 'ledge-40', tier: 1, items: [{ type: 'ledge', x: 0, w: 40 }] },
  { id: 'gap-24', tier: 1, items: [{ type: 'gap', x: 0, w: 24 }] },
  { id: 'kicker', tier: 1, items: [{ type: 'kicker', x: 0 }] },
  { id: 'cone-cone', tier: 1, items: [{ type: 'lowBlock', x: 0 }, { type: 'lowBlock', x: 130 }] },

  // Tier 2: pairs of ideas.
  { id: 'can-cone', tier: 2, items: [{ type: 'tallBlock', x: 0 }, { type: 'lowBlock', x: 130 }] },
  { id: 'rail-96-cone', tier: 2, items: [{ type: 'rail', x: 0, w: 96 }, { type: 'lowBlock', x: 200 }] },
  { id: 'gap-cone', tier: 2, items: [{ type: 'gap', x: 0, w: 32 }, { type: 'lowBlock', x: 120 }] },
  { id: 'kicker-gap', tier: 2, items: [{ type: 'kicker', x: 0 }, { type: 'gap', x: 50, w: 40 }] },
  { id: 'kicker-rail', tier: 2, items: [{ type: 'kicker', x: 0 }, { type: 'rail', x: 60, w: 120 }] },
  { id: 'ledge-64', tier: 2, items: [{ type: 'ledge', x: 0, w: 64 }] },
  { id: 'cone-rail', tier: 2, items: [{ type: 'lowBlock', x: 0 }, { type: 'rail', x: 140, w: 96 }] },

  // Tier 3: short chains.
  {
    id: 'cone-can-cone',
    tier: 3,
    items: [{ type: 'lowBlock', x: 0 }, { type: 'tallBlock', x: 120 }, { type: 'lowBlock', x: 240 }],
  },
  { id: 'rail-rail', tier: 3, items: [{ type: 'rail', x: 0, w: 80 }, { type: 'rail', x: 150, w: 80 }] },
  { id: 'gap-gap', tier: 3, items: [{ type: 'gap', x: 0, w: 40 }, { type: 'gap', x: 110, w: 40 }] },
  { id: 'can-rail', tier: 3, items: [{ type: 'tallBlock', x: 0 }, { type: 'rail', x: 130, w: 120 }] },
  {
    id: 'kicker-can-cone',
    tier: 3,
    items: [{ type: 'kicker', x: 0 }, { type: 'tallBlock', x: 60 }, { type: 'lowBlock', x: 220 }],
  },
  {
    id: 'ledge-cone-ledge',
    tier: 3,
    items: [{ type: 'ledge', x: 0, w: 48 }, { type: 'lowBlock', x: 130 }, { type: 'ledge', x: 240, w: 48 }],
  },
  { id: 'rail-gap', tier: 3, items: [{ type: 'rail', x: 0, w: 96 }, { type: 'gap', x: 180, w: 32 }] },
  { id: 'kicker-kicker', tier: 3, items: [{ type: 'kicker', x: 0 }, { type: 'kicker', x: 200 }] },

  // Tier 4: longer chains at top speed.
  {
    id: 'rail-can-rail',
    tier: 4,
    items: [{ type: 'rail', x: 0, w: 96 }, { type: 'tallBlock', x: 160 }, { type: 'rail', x: 300, w: 96 }],
  },
  {
    id: 'cone-x3',
    tier: 4,
    items: [{ type: 'lowBlock', x: 0 }, { type: 'lowBlock', x: 100 }, { type: 'lowBlock', x: 200 }],
  },
  { id: 'gap-rail', tier: 4, items: [{ type: 'gap', x: 0, w: 40 }, { type: 'rail', x: 110, w: 120 }] },
  {
    id: 'can-gap-can',
    tier: 4,
    items: [{ type: 'tallBlock', x: 0 }, { type: 'gap', x: 120, w: 36 }, { type: 'tallBlock', x: 250 }],
  },
  {
    id: 'kicker-rail-gap',
    tier: 4,
    items: [{ type: 'kicker', x: 0 }, { type: 'rail', x: 60, w: 120 }, { type: 'gap', x: 260, w: 32 }],
  },
  { id: 'ledge-rail', tier: 4, items: [{ type: 'ledge', x: 0, w: 64 }, { type: 'rail', x: 130, w: 120 }] },
];

export const SEGMENT_BY_ID = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

// Segments available at a tier, current-tier ones weighted up. Never the same
// segment twice in a row.
export function pickSegment(rng, tier, lastId, cfg) {
  let total = 0;
  for (const s of SEGMENTS) {
    if (s.tier <= tier && s.id !== lastId) total += s.tier === tier ? cfg.tiers.currentTierWeight : 1;
  }
  let r = rng.next() * total;
  for (const s of SEGMENTS) {
    if (s.tier > tier || s.id === lastId) continue;
    r -= s.tier === tier ? cfg.tiers.currentTierWeight : 1;
    if (r < 0) return s;
  }
  return SEGMENTS[0];
}
