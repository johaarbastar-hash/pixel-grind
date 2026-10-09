// Seeded random number generator (mulberry32). All gameplay randomness goes
// through one of these so any run can be replayed exactly from its seed.

export function createRng(seed) {
  let s = seed >>> 0;
  const rng = {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(a, b) {
      return a + (b - a) * rng.next();
    },
    int(a, b) {
      return a + Math.floor(rng.next() * (b - a + 1));
    },
    chance(p) {
      return rng.next() < p;
    },
    pick(list) {
      return list[Math.floor(rng.next() * list.length)];
    },
  };
  return rng;
}

export function randomSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] || 1;
  } catch {
    return Math.floor(Math.random() * 4294967295) + 1;
  }
}
