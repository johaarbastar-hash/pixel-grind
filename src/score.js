// Trick points and combos.
// - A combo runs from leaving the ground until touching it again; grinds keep
//   it alive (ollie > kickflip > grind > pop > heelflip > land is one combo).
// - Combo score = sum of trick points x multiplier.
// - Multiplier = number of different tricks in the combo (grind counts as one,
//   the ollie doesn't), minimum 1.
// - Repeats in the same combo score CONFIG.score.repeatFactors (2nd 50%, 3rd+ 25%).
// - Clean landing banks it, sketchy banks CONFIG.landing.sketchyBank, bail loses it.

export function createScore() {
  return {
    banked: 0, // trick points banked this run
    best: 0, // best single banked combo
    live: false,
    comboPoints: 0, // sum of trick points so far (before the multiplier)
    comboTricks: 0, // tricks in the combo, not counting ollies
    distinct: 0, // different tricks, not counting ollies
    chain: [], // trick ids in order, not counting ollies (for the HUD)
    counts: {}, // trick id -> times in this combo
    grindFactor: 1, // repeat factor of the grind in progress
  };
}

export function cloneScore(s) {
  return { ...s, chain: s.chain.slice(), counts: { ...s.counts } };
}

export function startCombo(s) {
  s.live = true;
  s.comboPoints = 0;
  s.comboTricks = 0;
  s.distinct = 0;
  s.chain.length = 0;
  s.counts = {};
  s.grindFactor = 1;
}

function repeatFactor(n, cfg) {
  const f = cfg.score.repeatFactors;
  return f[Math.min(n, f.length) - 1];
}

// Grinds score per tick (addGrindTick), at the factor set here.
export function addTrick(s, trick, cfg) {
  const n = (s.counts[trick] || 0) + 1;
  s.counts[trick] = n;
  const factor = repeatFactor(n, cfg);
  if (trick === 'grind') s.grindFactor = factor;
  else s.comboPoints += cfg.tricks[trick].points * factor;
  if (trick !== 'ollie') {
    s.chain.push(trick);
    s.comboTricks++;
    if (n === 1) s.distinct++;
  }
}

export function addGrindTick(s, cfg) {
  s.comboPoints += cfg.tricks.grind.points * s.grindFactor;
}

export function multiplier(s) {
  return Math.max(1, s.distinct);
}

export function comboValue(s) {
  return Math.floor(s.comboPoints * multiplier(s));
}

// Returns the points banked.
export function bankCombo(s, fraction) {
  const pts = Math.floor(s.comboPoints * multiplier(s) * fraction);
  s.banked += pts;
  if (pts > s.best) s.best = pts;
  s.live = false;
  return pts;
}

export function loseCombo(s) {
  s.live = false;
  s.comboPoints = 0;
  s.comboTricks = 0;
  s.distinct = 0;
  s.chain.length = 0;
}
