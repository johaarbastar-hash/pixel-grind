// Offscreen canvas at the internal resolution (180 px tall, 320-400 wide),
// drawn to the display canvas at a whole-number scale measured in device
// pixels. Plus the world drawing (background layers, obstacles, skater).

import { COL } from './sprites.js';

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

export function createRenderer(cfg, canvas, stage) {
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
    // Size and centre the canvas in whole device pixels.
    canvas.style.width = outW / dpr + 'px';
    canvas.style.height = outH / dpr + 'px';
    canvas.style.left = Math.floor((devW - outW) / 2) / dpr + 'px';
    canvas.style.top = Math.floor((devH - outH) / 2) / dpr + 'px';
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

export function drawWorld(g, W, run, sprites, cfg) {
  const groundY = cfg.world.groundY;
  const camX = Math.round(run.world.distance); // rounded once per frame
  const shake = shakeOffset(run, cfg);
  if (shake) {
    g.fillStyle = COL.ink;
    g.fillRect(0, 0, W, cfg.view.height);
    g.save();
    g.translate(shake, shake > 0 ? -1 : 1);
  }

  g.drawImage(sprites.sky, 0, 0);
  drawTiled(g, sprites.skyline, Math.round(run.world.distance * cfg.render.skylineParallax), groundY - sprites.skyline.height, W);
  drawTiled(g, sprites.street, camX, groundY, W);

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
    drawSkater(g, run.player, sprites.skater, cfg);
  }
  if (shake) g.restore();
}

function drawSkater(g, p, sk, cfg) {
  const x = cfg.world.skaterX;
  const y = Math.round(p.y);
  const groundY = cfg.world.groundY;

  if (p.bailed) {
    if (p.onGround && y === groundY) {
      const slide = Math.round(Math.min(cfg.bail.boardSlideMax, p.bailTime * cfg.bail.boardSlideSpeed));
      g.drawImage(sk.boardFlipped, x + cfg.skater.spriteW + slide, groundY - sk.boardFlipped.height);
    }
    g.drawImage(sk.bail, x - 4, y - sk.bail.height);
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
    }
    g.drawImage(img, x, y - cfg.skater.spriteH);
    return;
  }

  const frame = Math.floor(p.anim / cfg.ui.rollFrameTime) & 1;
  g.drawImage((p.grinding ? sk.grind : sk.ride)[frame], x, y - cfg.skater.spriteH);
}
