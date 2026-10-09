// Debug overlay (?debug=1 or the backtick key): frame stats, hitboxes, run info.
// The on-screen error box itself lives inline in index.html so it also catches
// module load failures; reportError() feeds it from inside the game loop.

import { drawText } from './font.js';
import { COL } from './sprites.js';

export function reportError(err) {
  console.error(err);
  const msg = err && err.stack ? err.stack : String(err);
  if (typeof window.__showError === 'function') window.__showError(msg);
}

export function createDebug(cfg, enabled) {
  const d = {
    enabled,
    fps: 0,
    ft: 0, // average ms between frames
    ftMax: 0, // worst frame in the window (spikes = stutter)
    cpu: 0, // average ms of update + render work
    cpuMax: 0,
    lines: [],
  };
  let frames = 0;
  let elapsed = 0;
  let ftMax = 0;
  let cpuSum = 0;
  let cpuMax = 0;
  let textAge = Infinity;

  d.toggle = () => {
    d.enabled = !d.enabled;
    textAge = Infinity;
  };

  // dt: real seconds since the previous frame (before clamping).
  d.frame = (dt) => {
    frames++;
    elapsed += dt;
    textAge += dt;
    if (dt * 1000 > ftMax) ftMax = dt * 1000;
    if (elapsed >= cfg.debug.statWindow) {
      d.fps = frames / elapsed;
      d.ft = (elapsed * 1000) / frames;
      d.ftMax = ftMax;
      d.cpu = cpuSum / frames;
      d.cpuMax = cpuMax;
      frames = 0;
      elapsed = 0;
      ftMax = 0;
      cpuSum = 0;
      cpuMax = 0;
    }
  };

  d.work = (ms) => {
    cpuSum += ms;
    if (ms > cpuMax) cpuMax = ms;
  };

  // makeLines() is only called a few times a second, so the overlay doesn't
  // create garbage every frame.
  d.draw = (g, W, makeLines) => {
    if (textAge >= cfg.debug.textRefresh) {
      d.lines = makeLines(d);
      textAge = 0;
    }
    const lines = d.lines;
    let longest = 0;
    for (const l of lines) longest = Math.max(longest, l.length);
    const w = longest * 8 + 5;
    const x = W - w - 2;
    const y = 14;
    g.fillStyle = 'rgba(13, 11, 26, 0.75)';
    g.fillRect(x, y, w, lines.length * 9 + 4);
    for (let i = 0; i < lines.length; i++) drawText(g, lines[i], x + 3, y + 3 + i * 9, COL.mint);
  };

  return d;
}

function outline(g, x, y, w, h, color) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  g.fillStyle = color;
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
}

export function drawHitboxes(g, W, run) {
  const camX = Math.round(run.world.distance);
  const hb = run.hitbox;
  if (hb.w > 0) outline(g, hb.x - camX, hb.y, hb.w, hb.h, COL.mint);
  for (const ob of run.world.obstacles) {
    const sx = ob.hit.x - camX;
    if (sx >= W) break;
    if (ob.solid) outline(g, sx, ob.hit.y, ob.hit.w, ob.hit.h, ob.grind ? COL.gold : COL.rose);
  }
}
