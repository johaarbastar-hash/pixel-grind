// Trick points and combos. A combo runs from leaving the ground until touching
// it again. M2 banks the plain sum of trick points: clean = full, sketchy =
// CONFIG.landing.sketchyBank, bail = lost. Multiplier, repeat decay, tokens and
// lives arrive in M4.

export function createScore() {
  return {
    banked: 0, // trick points banked this run
    comboPoints: 0,
    comboFlips: 0, // flips landed in the live combo
    live: false,
  };
}

export function startCombo(s) {
  s.live = true;
  s.comboPoints = 0;
  s.comboFlips = 0;
}

export function addTrick(s, trick, cfg) {
  s.comboPoints += cfg.tricks[trick].points;
  if (trick !== 'ollie') s.comboFlips++;
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
  s.comboFlips = 0;
}
