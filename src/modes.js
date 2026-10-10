// Challenge links. No DOM access: the caller passes the URL's search params.
//
// A challenge link is ?seed=S&beat=N&by=XYZ: play the course from seed S
// (no tutorial, so it's the same course the sender rode) and beat N, set by
// the player with initials XYZ.

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

// URLSearchParams -> { seed, beat, by } or null when the link isn't a
// valid challenge.
export function parseChallenge(params, cfg) {
  if (!params.has('beat') || !params.has('seed')) return null;
  const beat = uint(params.get('beat'), cfg.challenge.maxBeat);
  const seed = uint(params.get('seed'), 0xffffffff);
  if (beat === null || seed === null) return null;
  return { seed, beat, by: cleanInitials(params.get('by')) || '???' };
}

// The query string a SHARE sends.
export function challengeQuery(seed, score, by) {
  return `?seed=${seed >>> 0}&beat=${Math.max(0, Math.floor(score))}&by=${encodeURIComponent(cleanInitials(by) || 'YOU')}`;
}

// URL params a challenge link uses (removed when leaving challenge mode).
export const CHALLENGE_PARAMS = ['seed', 'beat', 'by'];
