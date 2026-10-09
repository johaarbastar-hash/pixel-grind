// Web Audio, everything synthesized: no audio files.
// Graph: voices -> sfx / music gain -> master gain -> speakers. Mute fades the
// master to 0. The AudioContext is created on the first tap (browsers keep
// audio locked until a user gesture). Music runs on a lookahead scheduler: a
// timer every ~25 ms schedules the notes of the next ~100 ms on the audio
// clock, so timing never depends on setTimeout jitter.
// iPhone: the hardware silent switch mutes Web Audio (known behaviour).

let cfg = null;
let ctx = null;
let master = null;
let musicOut = null;
let sfxOut = null;
let noiseBuf = null;
let muted = false;

export function configureAudio(config, { muted: m = false } = {}) {
  cfg = config;
  muted = m;
}

// --- Building blocks (also used by the offline tests) -------------------------

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(c) {
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345; // fixed noise, same every time
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    d[i] = (seed / 4294967296) * 2 - 1;
  }
  return b;
}

// 25% pulse: the classic chiptune lead.
function makePulse(c) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  return c.createPeriodicWave(real, imag);
}

// A voice set bound to a context and an output node.
export function makeVoices(c, out) {
  const noiseB = makeNoise(c);
  const pulse = makePulse(c);

  // Gain with a short attack and release so nothing clicks.
  function envelope(t, dur, peak) {
    const g = c.createGain();
    const a = Math.min(0.005, dur / 4);
    const r = Math.min(0.03, dur * 0.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0, t + dur);
    return g;
  }

  function tone(type, f0, f1, t, dur, peak, dest = out) {
    const o = c.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(pulse);
    else o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = envelope(t, dur, peak);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
    return o;
  }

  function noise(t, dur, peak, filter, f0, f1, q = 1, dest = out) {
    const s = c.createBufferSource();
    s.buffer = noiseB;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = envelope(t, dur, peak);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  function notes(type, list, t, step, len, peak) {
    list.forEach((m, i) => tone(type, midiHz(m), midiHz(m), t + i * step, len, peak));
  }

  return { c, out, noiseB, pulse, tone, noise, notes };
}

// --- Sound effects -------------------------------------------------------------
// Each takes (voices, start time, options).

export const SOUNDS = {
  // Short square "pop" with the pitch going up.
  ollie(v, t) {
    v.tone('square', 220, 520, t, 0.07, 0.12);
    v.noise(t, 0.03, 0.08, 'highpass', 3000, 3000);
  },
  kicker(v, t) {
    v.tone('square', 160, 640, t, 0.14, 0.11);
    v.noise(t, 0.08, 0.1, 'bandpass', 600, 2400, 2);
  },
  // Low thud + wheel click.
  land(v, t) {
    v.tone('sine', 140, 45, t, 0.1, 0.45);
    v.noise(t + 0.005, 0.025, 0.12, 'highpass', 4000, 4000);
  },
  // Wobbly, detuned thud.
  sketchy(v, t) {
    v.tone('sine', 140, 45, t, 0.1, 0.4);
    v.tone('triangle', 196, 150, t, 0.22, 0.12);
    v.tone('triangle', 208, 141, t, 0.22, 0.12);
  },
  // Quick whoosh: filtered noise sweep.
  flip(v, t) {
    v.noise(t, 0.16, 0.24, 'bandpass', 700, 3200, 1.2);
  },
  // Rail / ledge contact before the grind loop takes over.
  clank(v, t) {
    v.tone('square', 1480, 1320, t, 0.05, 0.05);
    v.noise(t, 0.06, 0.14, 'bandpass', 2600, 2600, 5);
  },
  // Classic coin: two rising notes.
  token(v, t) {
    v.tone('square', midiHz(83), midiHz(83), t, 0.06, 0.12);
    v.tone('square', midiHz(88), midiHz(88), t + 0.06, 0.14, 0.12);
  },
  // Rising arpeggio, higher for bigger combos (opts.points).
  combo(v, t, { points = 100 } = {}) {
    const lift = Math.min(12, Math.floor(Math.log2(points / 100 + 1) * 3));
    const base = 72 + lift;
    v.notes('pulse', [base, base + 4, base + 7, base + 12], t, 0.05, 0.07, 0.13);
  },
  // Noise crash + descending tone.
  bail(v, t) {
    v.noise(t, 0.45, 0.35, 'lowpass', 2400, 250);
    v.tone('sawtooth', 440, 90, t, 0.4, 0.08);
  },
  // Short 1-up jingle.
  extraBoard(v, t) {
    v.notes('square', [72, 76, 79, 84, 88, 91], t, 0.06, 0.07, 0.11);
  },
  blip(v, t) {
    v.tone('square', 660, 660, t, 0.03, 0.06);
  },
  select(v, t) {
    v.tone('square', 880, 1320, t, 0.07, 0.07);
  },
  countdown(v, t, { go = false } = {}) {
    v.tone('square', go ? 880 : 440, go ? 880 : 440, t, go ? 0.25 : 0.1, 0.08);
  },
  // Sad descending jingle.
  gameOver(v, t) {
    v.notes('triangle', [67, 63, 60], t, 0.22, 0.2, 0.18);
    v.tone('triangle', midiHz(55), midiHz(55), t + 0.66, 0.6, 0.18);
  },
  // New high score fanfare.
  fanfare(v, t) {
    v.notes('pulse', [72, 76, 79, 84], t, 0.09, 0.08, 0.08);
    v.notes('square', [79, 84], t + 0.38, 0.12, 0.36, 0.06);
    v.tone('triangle', midiHz(48), midiHz(48), t + 0.38, 0.6, 0.15);
  },
};

// --- Music -------------------------------------------------------------------
// 4-bar synthwave loop in A minor (Am - F - C - G): triangle bass pumping 8ths,
// 25% pulse lead, noise drums. 16 steps per bar.

const ROOTS = [45, 41, 48, 43];
const LEAD = [
  [76, 0, 81, 0, 84, 0, 83, 81, 0, 76, 0, 79, 81, 0, 0, 0],
  [77, 0, 81, 0, 84, 0, 81, 79, 0, 77, 0, 76, 77, 0, 0, 0],
  [79, 0, 84, 0, 88, 0, 86, 84, 0, 79, 0, 81, 79, 0, 0, 0],
  [79, 0, 83, 0, 86, 0, 83, 81, 0, 79, 0, 78, 79, 0, 74, 0],
];

export function scheduleMusicStep(v, i, t, stepDur) {
  const bar = (i >> 4) & 3;
  const s = i & 15;
  if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) v.tone('sine', 150, 40, t, 0.12, 0.6); // kick
  if (s === 4 || s === 12) v.noise(t, 0.12, 0.25, 'bandpass', 1800, 1200, 0.8); // snare
  if (s % 2 === 0) v.noise(t, 0.03, s % 4 === 2 ? 0.1 : 0.06, 'highpass', 7000, 7000); // hat
  if (s % 2 === 0) {
    const m = ROOTS[bar] + (s % 4 === 2 ? 12 : 0);
    v.tone('triangle', midiHz(m), midiHz(m), t, stepDur * 1.8, 0.35);
  }
  const lead = LEAD[bar][s];
  if (lead) v.tone('pulse', midiHz(lead), midiHz(lead), t, stepDur * 0.9, 0.12);
}

let sfxVoices = null;
let musicVoices = null;
const music = { playing: false, step: 0, nextTime: 0, bpm: 120, timer: 0 };

function musicTick() {
  if (!ctx || !music.playing) return;
  const stepDur = 60 / music.bpm / 4;
  // After a stall (tab in the background), skip ahead instead of piling up notes.
  if (music.nextTime < ctx.currentTime - 0.2) music.nextTime = ctx.currentTime + 0.05;
  while (music.nextTime < ctx.currentTime + cfg.audio.lookahead) {
    if (!muted) scheduleMusicStep(musicVoices, music.step, music.nextTime, stepDur);
    music.nextTime += stepDur;
    music.step = (music.step + 1) % 64;
  }
}

export function startMusic() {
  if (!ctx || music.playing) return;
  music.playing = true;
  music.nextTime = ctx.currentTime + 0.05;
  musicTick();
  music.timer = setInterval(musicTick, cfg.audio.schedulerInterval);
}

export function stopMusic() {
  music.playing = false;
  clearInterval(music.timer);
}

export function restartMusic() {
  music.step = 0;
}

export function setMusicTier(tier) {
  const list = cfg.audio.musicBpm;
  music.bpm = list[Math.max(0, Math.min(list.length - 1, tier - 1))];
}

// --- Grind loop: metallic noise while grinding ----------------------------------

let grind = null;

export function grindLoop(on) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (on && !grind) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const a = ctx.createBiquadFilter();
    a.type = 'bandpass';
    a.frequency.value = 2500;
    a.Q.value = 6;
    const b = ctx.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = 3900;
    b.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(cfg.audio.grindLevel, t + 0.02);
    src.connect(a).connect(g);
    src.connect(b).connect(g);
    g.connect(sfxOut);
    src.start(t);
    grind = { src, g };
  } else if (!on && grind) {
    const { src, g } = grind;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.03);
    src.stop(t + 0.05);
    grind = null;
  }
}

// --- Control -------------------------------------------------------------------

// Call from inside a user gesture (input.js onGesture / touchend).
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !cfg) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : cfg.audio.master;
      master.connect(ctx.destination);
      musicOut = ctx.createGain();
      musicOut.gain.value = cfg.audio.music;
      musicOut.connect(master);
      sfxOut = ctx.createGain();
      sfxOut.gain.value = cfg.audio.sfx;
      sfxOut.connect(master);
      noiseBuf = makeNoise(ctx);
      sfxVoices = makeVoices(ctx, sfxOut);
      musicVoices = makeVoices(ctx, musicOut);
    }
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
      // A silent one-sample buffer finishes the unlock on older iOS.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {
    // No audio: the game works without it.
  }
}

export function playSfx(name, opts) {
  if (!ctx || muted || ctx.state !== 'running') return;
  try {
    SOUNDS[name](sfxVoices, ctx.currentTime + 0.005, opts);
  } catch {
    // never let a sound break the game
  }
}

export function setMuted(m) {
  muted = m;
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(m ? 0 : cfg.audio.master, t + cfg.audio.muteRamp);
  if (m) grindLoop(false);
}

export function isMuted() {
  return muted;
}

// Tab hidden: suspend the context (saves battery); back: resume.
export function suspendAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}

export function resumeAudio() {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
}

export function audioState() {
  return ctx ? ctx.state : 'locked';
}

// Haptics: Android only; silently skipped where unsupported.
export function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // unsupported
  }
}
