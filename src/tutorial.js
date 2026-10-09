// First-run tutorial: a fixed 30-second opening (3000 px at start speed) with
// prompts. A bail rewinds to the last checkpoint instead of ending the run.
// No DOM access.

export const TUTORIAL = {
  length: 3000, // px; normal spawning (and the difficulty clock) starts after this
  items: [
    { type: 'lowBlock', x: 520 },
    { type: 'rail', x: 1350, w: 120 },
    { type: 'kicker', x: 2100 },
  ],
  // Shown while the camera's distance is in [from, to). touch / keys: one or
  // two lines.
  prompts: [
    { from: 120, to: 560, touch: ['TAP TO OLLIE'], keys: ['SPACE TO OLLIE'] },
    {
      from: 640,
      to: 1080,
      touch: ['SWIPE FOR A FLIP', '←KICKFLIP →HEELFLIP ↓SHOVE-IT ↑360'],
      keys: ['ARROW KEYS FOR A FLIP', '←KICKFLIP →HEELFLIP ↓SHOVE-IT ↑360'],
    },
    { from: 1080, to: 1420, touch: ['LAND ON IT TO GRIND'], keys: ['LAND ON IT TO GRIND'] },
    { from: 1780, to: 2200, touch: ['KICKERS = 2 FLIPS'], keys: ['KICKERS = 2 FLIPS'] },
    { from: 2650, to: 3000, touch: ['GO!'], keys: ['GO!'] },
  ],
  // Distances where progress is saved; a bail rewinds to the last one passed.
  checkpoints: [0, 600, 1100, 1800],
};

// Lines to show at this distance, or null.
export function tutorialPrompt(distance, touch) {
  for (const p of TUTORIAL.prompts) {
    if (distance >= p.from && distance < p.to) return touch ? p.touch : p.keys;
  }
  return null;
}
