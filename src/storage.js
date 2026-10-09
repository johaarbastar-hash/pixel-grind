// Saved settings and stats in localStorage, wrapped so the game works fully
// when storage is blocked (private mode, disabled cookies): values then live
// in memory for the session.

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

export function getSetting(name, fallback) {
  const v = load()[name];
  return v === undefined ? fallback : v;
}

export function setSetting(name, value) {
  load()[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked: keep it in memory.
  }
}
