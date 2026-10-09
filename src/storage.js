// Saved settings, high scores and stats in localStorage, wrapped so the game
// works fully when storage is blocked (private mode, disabled cookies): values
// then live in memory for the session.

const KEY = 'pixel-grind.v1';
let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    cache = {};
  }
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked: keep it in memory.
  }
}

export function getSetting(name, fallback) {
  const v = load()[name];
  return v === undefined ? fallback : v;
}

export function setSetting(name, value) {
  load()[name] = value;
  save();
}

// --- High scores: top 10 with 3-letter initials ------------------------------
// A fresh table comes pre-filled, arcade style, so there's something to beat.

const DEFAULT_SCORES = [
  ['PXG', 5000],
  ['RAD', 4500],
  ['SK8', 4000],
  ['OLY', 3500],
  ['KIK', 3000],
  ['HEL', 2500],
  ['GRN', 2000],
  ['FLP', 1500],
  ['NOS', 1000],
  ['TAL', 500],
].map(([name, score]) => ({ name, score }));

export function getScores() {
  const s = load().scores;
  return Array.isArray(s) && s.length ? s : DEFAULT_SCORES;
}

// Rank (0-9) a score would get in the table, or -1.
export function scoreRank(score) {
  const list = getScores();
  for (let i = 0; i < 10; i++) {
    if (i >= list.length || score > list[i].score) return i;
  }
  return -1;
}

export function addScore(name, score) {
  const list = getScores().slice();
  const rank = scoreRank(score);
  if (rank < 0) return -1;
  list.splice(rank, 0, { name, score });
  load().scores = list.slice(0, 10);
  save();
  return rank;
}

// --- Stats -------------------------------------------------------------------

export function getStats() {
  return { runs: 0, distance: 0, bestCombo: 0, tricks: 0, ...load().stats };
}

// distance in px; tricks = flips and grinds landed.
export function recordRun({ distance, bestCombo, tricks }) {
  const s = getStats();
  s.runs++;
  s.distance += Math.round(distance);
  s.bestCombo = Math.max(s.bestCombo, bestCombo);
  s.tricks += tricks;
  load().stats = s;
  save();
}
