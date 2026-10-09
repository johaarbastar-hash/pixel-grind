// HUD and full-screen prompts (title, game over, pause, rotate), combo chain,
// popups.

import { drawText, CHAR_W } from './font.js';
import { COL } from './sprites.js';
import { multiplier, comboValue } from './score.js';
import { TRICK_NAMES } from './tricks.js';

// --- HUD ---------------------------------------------------------------------
// Score top-left, hi-score top-centre, pause button in the top-right corner
// with the board icons just left of it. Strings are rebuilt only on change.

const pad = (n) => String(n).padStart(6, '0');
let hudScore = -1;
let hudText = '';
let hudHi = -1;
let hudHiText = '';

// The pause button's touch area is much bigger than its icon (internal px
// from the top-right corner), so it is easy to hit without looking.
const PAUSE_HIT_W = 30;
const PAUSE_HIT_H = 22;

export function hitPauseButton(x, y, W) {
  return x >= W - PAUSE_HIT_W && x <= W && y >= 0 && y <= PAUSE_HIT_H;
}

export function drawHud(g, W, run, best, sprites) {
  if (run.score !== hudScore) {
    hudScore = run.score;
    hudText = pad(run.score);
  }
  const hi = Math.max(best, run.score);
  if (hi !== hudHi) {
    hudHi = hi;
    hudHiText = 'HI ' + pad(hi);
  }
  drawText(g, hudText, 4, 4, COL.cream, { shadow: COL.ink });
  drawText(g, hudHiText, W >> 1, 4, COL.steel, { align: 'center', shadow: COL.ink });
  const icon = sprites.pauseIcon;
  g.drawImage(icon, W - icon.width - 3, 3);
  const b = sprites.boardIcon;
  for (let i = 0; i < run.boards; i++) g.drawImage(b, W - icon.width - 8 - (i + 1) * (b.width + 2), 6);
}

// --- Combo chain ---------------------------------------------------------------
// While a combo is live: the trick chain ("KICKFLIP + GRIND") and its value
// with the multiplier ("220 x2").

let comboLen = -1;
let comboPts = -1;
let comboLine1 = '';
let comboLine2 = '';

export function drawCombo(g, W, s) {
  if (!s.live || s.comboTricks === 0) return;
  const value = comboValue(s);
  if (s.chain.length !== comboLen || value !== comboPts) {
    comboLen = s.chain.length;
    comboPts = value;
    const maxChars = Math.floor((W - 16) / CHAR_W);
    let line = TRICK_NAMES[s.chain[s.chain.length - 1]];
    for (let i = s.chain.length - 2; i >= 0; i--) {
      const next = TRICK_NAMES[s.chain[i]] + ' + ' + line;
      if (next.length > maxChars - 4) {
        line = '... ' + line;
        break;
      }
      line = next;
    }
    comboLine1 = line;
    comboLine2 = value + ' x' + multiplier(s);
  }
  drawText(g, comboLine1, W >> 1, 38, COL.cream, { align: 'center', shadow: COL.ink });
  drawText(g, comboLine2, W >> 1, 48, COL.gold, { align: 'center', shadow: COL.ink });
}

function blinkOn(t, cfg) {
  return Math.floor(t / cfg.ui.blinkPeriod) % 2 === 0;
}

export function drawStartScreen(g, W, H, t, touch, build, cfg) {
  const cx = W >> 1;
  drawText(g, 'PIXEL GRIND', cx, 28, COL.gold, { align: 'center', scale: 2, shadow: COL.ink });
  if (blinkOn(t, cfg)) {
    drawText(g, touch ? 'TAP TO START' : 'SPACE OR CLICK TO START', cx, 84, COL.cream, { align: 'center', shadow: COL.ink });
  }
  drawText(g, touch ? 'TAP TO OLLIE' : 'SPACE TO OLLIE', cx, 100, COL.mint, { align: 'center', shadow: COL.ink });
  drawText(g, touch ? 'SWIPE TO FLIP' : 'ARROWS TO FLIP', cx, 110, COL.mint, { align: 'center', shadow: COL.ink });
  drawText(g, 'BUILD ' + build, W - 4, H - 10, COL.steel, { align: 'right' });
}

// By bail reason: obstacle type (city skin names), 'gap' or 'flip'.
const BAIL_REASON = {
  lowBlock: 'HIT A CONE',
  tallBlock: 'HIT A TRASH CAN',
  ledge: 'HIT A LEDGE',
  rail: 'HIT A RAIL',
  gap: 'FELL IN A HOLE',
  flip: 'LANDED MID-FLIP',
};

// Tutorial prompt across the top of the screen.
export function drawPrompt(g, W, text) {
  drawText(g, text, W >> 1, 24, COL.gold, { align: 'center', shadow: COL.ink });
}

// Game over (full screen with best combo etc. comes in M6).
export function drawGameOverScreen(g, W, H, t, run, canRetry, touch, sprites, cfg) {
  const cx = W >> 1;
  g.drawImage(sprites.checker, 0, 0);
  drawText(g, 'GAME OVER', cx, 36, COL.rose, { align: 'center', scale: 2, shadow: COL.ink });
  drawText(g, BAIL_REASON[run.bailReason] || '', cx, 58, COL.steel, { align: 'center', shadow: COL.ink });
  drawText(g, 'SCORE ' + run.score, cx, 74, COL.cream, { align: 'center', shadow: COL.ink });
  drawText(g, 'BEST COMBO ' + run.tricks.best, cx, 84, COL.cream, { align: 'center', shadow: COL.ink });
  if (canRetry && blinkOn(t, cfg)) {
    drawText(g, touch ? 'TAP TO RETRY' : 'SPACE TO RETRY', cx, 104, COL.gold, { align: 'center', shadow: COL.ink });
  }
}

// --- Trick popups ------------------------------------------------------------
// Fixed pool; newest sits lowest and older ones stack above it.

const POPUPS = Array.from({ length: 4 }, () => ({ text: '', color: '', age: 0, active: false }));
const POPUP_Y = 72;
const POPUP_SPACING = 10;

export function addPopup(text, color) {
  let slot = POPUPS[0];
  for (const p of POPUPS) {
    if (!p.active) {
      slot = p;
      break;
    }
    if (p.age > slot.age) slot = p;
  }
  slot.text = text;
  slot.color = color;
  slot.age = 0;
  slot.active = true;
}

export function clearPopups() {
  for (const p of POPUPS) p.active = false;
}

export function updatePopups(dt, cfg) {
  for (const p of POPUPS) {
    if (!p.active) continue;
    p.age += dt;
    if (p.age >= cfg.ui.popupTime) p.active = false;
  }
}

export function drawPopups(g, W, cfg) {
  const life = cfg.ui.popupTime;
  for (const p of POPUPS) {
    if (!p.active) continue;
    // Blink out over the last 20% of its life.
    if (p.age > life * 0.8 && Math.floor(p.age * 16) % 2 === 1) continue;
    let rank = 0;
    for (const q of POPUPS) if (q.active && q.age < p.age) rank++;
    const y = POPUP_Y - rank * POPUP_SPACING - Math.floor((p.age / life) * cfg.ui.popupRise);
    drawText(g, p.text, W >> 1, y, p.color, { align: 'center', shadow: COL.ink });
  }
}

export function drawPausedScreen(g, W, H, t, touch, sprites, cfg) {
  const cx = W >> 1;
  g.drawImage(sprites.checker, 0, 0);
  drawText(g, 'PAUSED', cx, 56, COL.cream, { align: 'center', scale: 2, shadow: COL.ink });
  if (blinkOn(t, cfg)) {
    drawText(g, touch ? 'TAP TO RESUME' : 'SPACE TO RESUME', cx, 90, COL.gold, { align: 'center', shadow: COL.ink });
  }
}

// Phone outline that flips between portrait and landscape. Drawn big: in
// portrait the 16:9 canvas is only a band across the middle of the screen.
export function drawRotateScreen(g, W, H, t, cfg) {
  g.fillStyle = COL.ink;
  g.fillRect(0, 0, W, H);
  const landscape = Math.floor(t / cfg.ui.rotateFrameTime) % 2 === 1;
  const pw = landscape ? 48 : 28;
  const ph = landscape ? 28 : 48;
  const px = (W - pw) >> 1;
  const py = 30 + ((48 - ph) >> 1);
  g.fillStyle = COL.cream;
  g.fillRect(px, py, pw, ph);
  g.fillStyle = COL.ink;
  g.fillRect(px + 3, py + 3, pw - 6, ph - 6);
  g.fillStyle = landscape ? COL.mint : COL.slate;
  g.fillRect(px + 4, py + 4, pw - 8, ph - 8);
  drawText(g, 'ROTATE', W >> 1, 96, COL.cream, { align: 'center', scale: 2 });
  drawText(g, 'YOUR PHONE', W >> 1, 118, COL.cream, { align: 'center', scale: 2 });
}
