// Challenge links, the daily run and the streak. No DOM access: the caller
// passes the URL's search params. Dates are local calendar days as 'YYYYMMDD'.
//
// A challenge link is ?seed=S&beat=N&by=XYZ: play the course from seed S
// (no tutorial, so it's the same course the sender rode) and beat N, set by
// the player with initials XYZ. A daily challenge is ?daily=YYYYMMDD&beat=N&by=XYZ:
// that day's daily course.

import { getSetting, setSetting } from './storage.js';

// Up to 3 letters / digits, upper case; anything else gives null.
export function cleanInitials(s) {
  const t = String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  return t || null;
}

const uint = (s, max) => {
  if (!/^\d{1,10}$/.test(String(s))) return null;
  const n = Number(s);
  return n <= max ? n : null;
};

// --- Dates and the daily seed -------------------------------------------------

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function isDateKey(s) {
  if (!/^\d{8}$/.test(String(s))) return false;
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

// Same seed for a date on every phone: FNV-1a over 'YYYYMMDD', then a final
// mix so neighbouring days give unrelated courses.
export function dailySeed(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// --- Challenge links ------------------------------------------------------------

// URLSearchParams -> { seed, daily (date key or null), beat, by } or null when
// the link isn't a valid challenge.
export function parseChallenge(params, cfg) {
  if (!params.has('beat')) return null;
  const beat = uint(params.get('beat'), cfg.challenge.maxBeat);
  if (beat === null) return null;
  const by = cleanInitials(params.get('by')) || '???';
  if (params.has('daily')) {
    const daily = params.get('daily');
    return isDateKey(daily) ? { seed: dailySeed(daily), daily, beat, by } : null;
  }
  if (!params.has('seed')) return null;
  const seed = uint(params.get('seed'), 0xffffffff);
  return seed === null ? null : { seed, daily: null, beat, by };
}

// The query string a SHARE sends: the daily course by date, otherwise the seed.
export function challengeQuery(seed, daily, score, by) {
  const course = daily ? `daily=${daily}` : `seed=${seed >>> 0}`;
  return `?${course}&beat=${Math.max(0, Math.floor(score))}&by=${encodeURIComponent(cleanInitials(by) || 'YOU')}`;
}

// URL params a challenge link uses (removed when leaving challenge mode).
export const CHALLENGE_PARAMS = ['seed', 'daily', 'beat', 'by'];

// --- Daily record: today's best and attempts ----------------------------------------

export function getDaily(today) {
  const d = getSetting('daily', null);
  if (d && d.date === today) return { date: today, best: d.best | 0, attempts: d.attempts | 0 };
  return { date: today, best: 0, attempts: 0 };
}

export function recordDailyAttempt(today) {
  const d = getDaily(today);
  d.attempts++;
  setSetting('daily', d);
}

// Returns true if the score is a new best for that day.
export function recordDailyScore(day, score) {
  const d = getDaily(day);
  if (score <= d.best) return false;
  d.best = score;
  setSetting('daily', d);
  return true;
}

// --- Streak: consecutive days with a finished run ----------------------------------

export function prevDay(key) {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)) - 1);
  return dateKey(d);
}

// The streak as of today: 0 once a calendar day has been skipped (no grace).
export function getStreak(today) {
  const s = getSetting('streak', null);
  if (!s || !isDateKey(s.last)) return 0;
  return s.last === today || s.last === prevDay(today) ? Math.max(0, s.count | 0) : 0;
}

// Call when a run is finished (game over). The first one of the day extends
// the streak (or starts a new one) and pays the bonus: { streak, bonus }.
export function finishRunForStreak(today, cfg) {
  const s = getSetting('streak', null);
  if (s && s.last === today) return { streak: Math.max(1, s.count | 0), bonus: 0 };
  const count = getStreak(today) + 1;
  setSetting('streak', { last: today, count });
  return { streak: count, bonus: Math.min(count, cfg.streak.maxDays) * cfg.streak.bonusPerDay };
}
