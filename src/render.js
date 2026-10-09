// Offscreen canvas at the internal resolution (180 px tall, 320-400 wide),
// drawn to the display canvas at a whole-number scale measured in device
// pixels. Plus the world drawing (background layers, obstacles, skater).

import { COL, phaseAt } from './sprites.js';

// Pure layout maths, kept separate so it can be tested without a browser.
// devW / devH: the playable area in device pixels.
export function fitLayout(devW, devH, view) {
  const scale = Math.min(Math.floor(devH / view.height), Math.floor(devW / view.minWidth));
  if (scale >= 1) {
    const width = Math.max(view.minWidth, Math.min(view.maxWidth, Math.floor(devW / scale)));
    return { scale, width };
  }
  // Smaller than 1x (tiny desktop window): fractional fit as a last resort.
  return { scale: Math.max(0.1, Math.min(devH / view.height, devW / view.minWidth)), width: view.minWidth };
}

export function createRenderer(cfg, canvas, stage, overlay = null) {
  const H = cfg.view.height;
  const display = canvas.getContext('2d', { alpha: false });
  const buf = document.createElement('canvas');
  buf.width = cfg.view.minWidth;
  buf.height = H;
  const g = buf.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;

  const r = {
    g,
    width: buf.width,
    height: H,
    scale: 1,
    dpr: 1,
    devW: 0,
    devH: 0,
    present,
  };

  function apply(devW, devH) {
    const dpr = window.devicePixelRatio || 1;
    if (devW === r.devW && devH === r.devH && dpr === r.dpr) return;
    r.devW = devW;
    r.devH = devH;
    r.dpr = dpr;
    const { scale, width } = fitLayout(devW, devH, cfg.view);
    r.scale = scale;
    if (width !== buf.width) {
      buf.width = width; // resets context state
      g.imageSmoothingEnabled = false;
    }
    r.width = width;
    const outW = Math.round(width * scale);
    const outH = Math.round(H * scale);
    canvas.width = outW; // resets context state
    canvas.height = outH;
    display.imageSmoothingEnabled = false;
    // Size and centre the canvas in whole device pixels; the CRT overlay
    // matches it, with one scanline per game pixel row.
    for (const el of overlay ? [canvas, overlay] : [canvas]) {
      el.style.width = outW / dpr + 'px';
      el.style.height = outH / dpr + 'px';
      el.style.left = Math.floor((devW - outW) / 2) / dpr + 'px';
      el.style.top = Math.floor((devH - outH) / 2) / dpr + 'px';
    }
    if (overlay) overlay.style.setProperty('--row', scale / dpr + 'px');
  }

  function measureFallback() {
    const dpr = window.devicePixelRatio || 1;
    const rect = stage.getBoundingClientRect();
    apply(Math.round(rect.width * dpr), Math.round(rect.height * dpr));
  }

  measureFallback();

  // device-pixel-content-box gives the exact size in device pixels (Chrome,
  // Firefox). Safari falls back to CSS size x devicePixelRatio, which is exact
  // there because its ratios are whole numbers.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver((entries) => {
      const e = entries[entries.length - 1];
      const dp = e.devicePixelContentBoxSize && e.devicePixelContentBoxSize[0];
      if (dp) apply(dp.inlineSize, dp.blockSize);
      else {
        const dpr = window.devicePixelRatio || 1;
        apply(Math.round(e.contentRect.width * dpr), Math.round(e.contentRect.height * dpr));
      }
    });
    try {
      ro.observe(stage, { box: 'device-pixel-content-box' });
    } catch {
      ro.observe(stage);
    }
  }
  window.addEventListener('resize', measureFallback);

  function present() {
    display.drawImage(buf, 0, 0, buf.width, H, 0, 0, canvas.width, canvas.height);
  }

  // Page (CSS) coordinates to internal pixels, for on-screen buttons.
  const point = { x: 0, y: 0 };
  r.toInternal = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    point.x = ((clientX - rect.left) * r.width) / rect.width;
    point.y = ((clientY - rect.top) * H) / rect.height;
    return point;
  };

  return r;
}

// --- World drawing ---------------------------------------------------------

function drawTiled(g, img, offset, y, W) {
  const tw = img.width;
  let x = -(((offset % tw) + tw) % tw);
  for (; x < W; x += tw) g.drawImage(img, x, y);
}

// Screen shake in whole pixels, alternating sides, fading out.
function shakeOffset(run, cfg) {
  if (run.shake <= 0) return 0;
  const amp = Math.ceil((cfg.bail.shakePx * run.shake) / cfg.bail.shakeTime);
  return Math.floor(run.shake * 60) % 2 ? amp : -amp;
}

// Street lamps come on at dusk, flickering for a moment first.
function lampsOn(phase, clock, cfg) {
  if (phase < 1) return false;
  const since = clock - cfg.render.phaseTime;
  if (phase > 1 || since > cfg.render.lampFlicker) return true;
  const k = Math.floor(since * 14);
  return ((k * 2654435761) >>> 0) % 3 !== 0;
}

// --- Particles: fixed pool, oldest overwritten, no allocation while playing ---

export function createParticles(n) {
  const pool = Array.from({ length: n }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, grav: 0, color: '', on: false }));
  let next = 0;
  return {
    pool,
    // x in world px, y in screen px.
    spawn(x, y, vx, vy, life, color, grav = 0) {
      const p = pool[next];
      next = (next + 1) % n;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.age = 0;
      p.life = life;
      p.grav = grav;
      p.color = color;
      p.on = true;
    },
    update(dt) {
      for (const p of pool) {
        if (!p.on) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.on = false;
          continue;
        }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    clear() {
      for (const p of pool) p.on = false;
    },
  };
}

// 2x2 for the first half of a particle's life, then 1x1: shrinks instead of fading.
function drawParticles(g, parts, camX, W) {
  for (const p of parts.pool) {
    if (!p.on) continue;
    const x = Math.round(p.x - camX);
    if (x < -2 || x > W) continue;
    const s = p.age < p.life / 2 ? 2 : 1;
    g.fillStyle = p.color;
    g.fillRect(x, Math.round(p.y), s, s);
  }
}

export function drawWorld(g, W, run, sprites, cfg, parts) {
  const groundY = cfg.world.groundY;
  const camX = Math.round(run.world.distance); // rounded once per frame
  const phase = phaseAt(run.world.clock, cfg);
  const shake = shakeOffset(run, cfg);
  if (shake) {
    g.fillStyle = COL.ink;
    g.fillRect(0, 0, W, cfg.view.height);
    g.save();
    g.translate(shake, shake > 0 ? -1 : 1);
  }

  const d = run.world.distance;
  g.drawImage(sprites.sky[phase], 0, 0);
  const far = sprites.skyline[phase];
  drawTiled(g, far, Math.round(d * cfg.render.skylineParallax), groundY - far.height, W);
  const mid = sprites.mid[phase];
  drawTiled(g, mid, Math.round(d * cfg.render.midParallax), groundY - mid.height, W);
  drawTiled(g, sprites.street, camX, groundY, W);
  const props = sprites.props[lampsOn(phase, run.world.clock, cfg) ? 1 : 0];
  drawTiled(g, props, camX, groundY - props.height + 6, W);

  const list = run.world.obstacles;
  for (let i = 0; i < list.length; i++) {
    const ob = list[i];
    const sx = ob.x - camX;
    if (sx >= W) break;
    if (sx + ob.w <= 0) continue;
    g.drawImage(sprites.obstacle(ob), sx, ob.y);
  }

  const tokens = run.world.tokens;
  const spin = sprites.token[Math.floor(run.time / cfg.tokens.spinFrameTime) % sprites.token.length];
  const half = cfg.tokens.size / 2;
  for (let i = 0; i < tokens.length; i++) {
    const sx = tokens[i].x - half - camX;
    if (sx >= W) break;
    if (sx > -cfg.tokens.size) g.drawImage(spin, sx, tokens[i].y - half);
  }

  // Blinks while invulnerable after a respawn.
  if (!(run.invuln > 0 && Math.floor(run.invuln * cfg.bail.blinkRate) % 2 === 1)) {
    drawSkater(g, run, sprites.skater, cfg);
  }
  if (parts) drawParticles(g, parts, camX, W);
  if (shake) g.restore();
}

function drawSkater(g, run, sk, cfg) {
  const p = run.player;
  const a = cfg.anim;
  const x = cfg.world.skaterX;
  const y = Math.round(p.y);
  const groundY = cfg.world.groundY;
  const h = cfg.skater.spriteH;

  if (p.bailed) {
    // Back on the board just before the respawn.
    if (!run.over && run.downTime > cfg.bail.respawnDelay - a.getUpTime) {
      g.drawImage(sk.getUp, x, groundY - h);
      return;
    }
    if (p.onGround && y === groundY) {
      const slide = Math.round(Math.min(cfg.bail.boardSlideMax, p.bailTime * cfg.bail.boardSlideSpeed));
      g.drawImage(sk.boardFlipped, x + cfg.skater.spriteW + slide, groundY - sk.boardFlipped.height);
    }
    // Wipeout: thrown back, flat in the air, then lying on the ground.
    const t = Math.floor(p.bailTime / a.tumbleFrameTime);
    if (t < sk.tumble.length) g.drawImage(sk.tumble[t], x - 4, y - sk.tumble[t].height);
    else g.drawImage(sk.bail, x - 4, y - sk.bail.height);
    return;
  }

  if (!p.onGround && !p.grinding) {
    // Shadow on the ground shrinks as the skater rises.
    const w = Math.max(4, 12 - Math.floor((groundY - y) / 4));
    g.fillStyle = COL.ink;
    g.fillRect(x + 8 - (w >> 1), groundY, w, 1);
    let img = sk.air;
    if (p.flip) {
      const frames = sk.flips[p.flip];
      const i = Math.floor((p.flipTime / p.flipDur) * frames.length);
      img = frames[Math.max(0, Math.min(frames.length - 1, i))];
    } else if (p.vy < 0 && p.airTime < a.popTime) {
      img = sk.pop; // ollie snap
    }
    g.drawImage(img, x, y - h);
    return;
  }

  if (p.grinding) {
    g.drawImage(sk.grind[Math.floor(p.anim / cfg.ui.rollFrameTime) & 1], x, y - h);
    return;
  }

  // Rolling: squash on landing, a kick-push every so often, else cruising.
  let img;
  if (p.rollTime < a.squashTime) img = sk.squash;
  else {
    const cycle = p.rollTime % a.pushEvery;
    const push = Math.floor(cycle / a.pushFrameTime);
    if (p.rollTime > a.pushEvery / 2 && push < sk.push.length) img = sk.push[push];
    else img = sk.ride[Math.floor(p.anim / cfg.ui.rollFrameTime) & 1];
  }
  g.drawImage(img, x, y - h);
}
