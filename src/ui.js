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
// with the multiplier ("220 x2"). After landing, the chain stays up for
// CONFIG.ui.comboHoldTime with the result under it ("+220" / "SKETCHY! +110"),
// unless a new combo with tricks takes its place.

const COMBO_Y = 38;

// Newest tricks win when the chain is too long for the screen.
function chainText(chain, W) {
  const maxChars = Math.floor((W - 16) / CHAR_W);
  let line = TRICK_NAMES[chain[chain.length - 1]];
  for (let i = chain.length - 2; i >= 0; i--) {
    const next = TRICK_NAMES[chain[i]] + ' + ' + line;
    if (next.length > maxChars - 4) return '... ' + line;
    line = next;
  }
  return line;
}

let liveLen = -1;
let livePts = -1;
let liveLine1 = '';
let liveLine2 = '';
const held = { line1: '', line2: '', color: '', age: 0, active: false };

// Called when a combo banks: keep its chain on screen with the result.
export function holdCombo(chain, result, color, W) {
  held.line1 = chainText(chain, W);
  held.line2 = result;
  held.color = color;
  held.age = 0;
  held.active = true;
}

export function updateCombo(dt, cfg) {
  if (!held.active) return;
  held.age += dt;
  if (held.age >= cfg.ui.comboHoldTime) held.active = false;
}

export function clearCombo() {
  held.active = false;
}

export function drawCombo(g, W, s, cfg) {
  if (s.live && s.comboTricks > 0) {
    held.active = false;
    const value = comboValue(s);
    if (s.chain.length !== liveLen || value !== livePts) {
      liveLen = s.chain.length;
      livePts = value;
      liveLine1 = chainText(s.chain, W);
      liveLine2 = value + ' x' + multiplier(s);
    }
    drawText(g, liveLine1, W >> 1, COMBO_Y, COL.cream, { align: 'center', shadow: COL.ink });
    drawText(g, liveLine2, W >> 1, COMBO_Y + 10, COL.gold, { align: 'center', shadow: COL.ink });
    return;
  }
  if (!held.active) return;
  // Blink out over the last 20%.
  const hold = cfg.ui.comboHoldTime;
  if (held.age > hold * 0.8 && Math.floor(held.age * 16) % 2 === 1) return;
  drawText(g, held.line1, W >> 1, COMBO_Y, COL.cream, { align: 'center', shadow: COL.ink });
  drawText(g, held.line2, W >> 1, COMBO_Y + 10, held.color, { align: 'center', shadow: COL.ink });
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

// --- Pause menu ------------------------------------------------------------------
// Rows are big touch targets; the selected one is boxed (keyboard: up / down,
// Space to pick).

const MENU_TOP = 60;
const MENU_ROW = 18;
const MENU_HALF_W = 76;

// Index of the menu row at internal point (x, y), or -1.
export function pauseMenuItemAt(x, y, W, count) {
  const cx = W >> 1;
  if (x < cx - MENU_HALF_W || x > cx + MENU_HALF_W) return -1;
  const i = Math.floor((y - MENU_TOP + 5) / MENU_ROW);
  return i >= 0 && i < count ? i : -1;
}

export function drawPauseMenu(g, W, H, items, selected, sprites) {
  const cx = W >> 1;
  g.drawImage(sprites.checker, 0, 0);
  drawText(g, 'PAUSED', cx, 30, COL.cream, { align: 'center', scale: 2, shadow: COL.ink });
  for (let i = 0; i < items.length; i++) {
    const y = MENU_TOP + i * MENU_ROW;
    if (i === selected) {
      g.fillStyle = COL.indigo;
      g.fillRect(cx - MENU_HALF_W, y - 5, MENU_HALF_W * 2, MENU_ROW - 1);
      g.fillStyle = COL.gold;
      g.fillRect(cx - MENU_HALF_W, y - 5, 2, MENU_ROW - 1);
      g.fillRect(cx + MENU_HALF_W - 2, y - 5, 2, MENU_ROW - 1);
    }
    drawText(g, items[i], cx, y, i === selected ? COL.gold : COL.cream, { align: 'center', shadow: COL.ink });
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
