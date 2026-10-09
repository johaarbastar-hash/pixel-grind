// Trick points and combos. A combo runs from leaving the ground until touching
// it again; grinds keep it alive. For now the plain sum of trick points is
// banked: clean = full, sketchy = CONFIG.landing.sketchyBank, bail = lost.
// Multiplier, repeat decay, tokens and lives arrive in M4.

export function createScore() {
  return {
    banked: 0, // trick points banked this run
    comboPoints: 0,
    comboTricks: 0, // flips and grinds in the live combo (the ollie doesn't count)
    live: false,
  };
}

export function startCombo(s) {
  s.live = true;
  s.comboPoints = 0;
  s.comboTricks = 0;
}

// Adds a trick's base points; grinds score per tick through addPoints instead.
export function addTrick(s, trick, cfg) {
  if (trick !== 'grind') s.comboPoints += cfg.tricks[trick].points;
  if (trick !== 'ollie') s.comboTricks++;
}

export function addPoints(s, points) {
  s.comboPoints += points;
}

// Returns the points banked.
export function bankCombo(s, fraction) {
  const pts = Math.floor(s.comboPoints * fraction);
  s.banked += pts;
  s.live = false;
  return pts;
}

export function loseCombo(s) {
  s.live = false;
  s.comboPoints = 0;
  s.comboTricks = 0;
}
