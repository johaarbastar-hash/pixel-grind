// HUD and full-screen prompts (title, game over, pause, shop, rotate), combo
// chain, popups.

import { drawText, CHAR_W } from './font.js';
import { COL } from './sprites.js';
import { multiplier, comboValue } from './score.js';
import { TRICK_NAMES } from './tricks.js';

// --- HUD ---------------------------------------------------------------------
// Score top-left with the run's coins under it, hi-score top-centre, pause
// button in the top-right corner with the board icons just left of it.
// Strings are rebuilt only on change.

const pad = (n) => String(n).padStart(6, '0');
let hudScore = -1;
let hudText = '';
let hudHi = -1;
let hudHiText = '';
let hudCoins = -1;
let hudCoinText = '';

// The pause button's touch area is much bigger than its icon (internal px
// from the top-right corner), so it is easy to hit without looking.
const PAUSE_HIT_W = 30;
const PAUSE_HIT_H = 22;

export function hitPauseButton(x, y, W) {
  return x >= W - PAUSE_HIT_W && x <= W && y >= 0 && y <= PAUSE_HIT_H;
}

// newBest: the run has passed the #1 score, so the hi-score shows the live
// score in gold.
export function drawHud(g, W, run, best, sprites, newBest) {
  if (run.score !== hudScore) {
    hudScore = run.score;
    hudText = pad(run.score);
  }
  const hi = Math.max(best, run.score);
  if (hi !== hudHi) {
    hudHi = hi;
    hudHiText = 'HI ' + pad(hi);
  }
  if (run.coins !== hudCoins) {
    hudCoins = run.coins;
    hudCoinText = '¤' + run.coins;
  }
  drawText(g, hudText, 4, 4, COL.cream, { shadow: COL.ink });
  drawText(g, hudCoinText, 4, 14, COL.gold, { shadow: COL.ink });
  drawText(g, hudHiText, W >> 1, 4, newBest ? COL.gold : COL.steel, { align: 'center', shadow: COL.ink });
  const icon = sprites.pauseIcon;
  g.drawImage(icon, W - icon.width - 3, 3);
  const b = sprites.boardIcon;
  for (let i = 0; i < run.boards; i++) g.drawImage(b, W - icon.width - 8 - (i + 1) * (b.width + 2), 6);
}

// --- Combo chain ---------------------------------------------------------------
// While a combo is live: the trick chain ("KICKFLIP + GRIND") and its value
// with the multiplier ("220 x2"); the value pulses (2x, in the tier's colour)
// each time it crosses a hype tier. After landing, the chain stays up for
// CONFIG.ui.comboHoldTime with the result under it ("+220" / "SKETCHY! +110"),
// and the tier word above the result for a combo that reached one, unless a
// new combo with tricks takes its place.

const COMBO_Y = 38;

// Index of the highest hype tier (CONFIG.hype.tiers) at or under points, or -1.
export function hypeTier(points, cfg) {
  const tiers = cfg.hype.tiers;
  let i = -1;
  while (i + 1 < tiers.length && points >= tiers[i + 1].points) i++;
  return i;
}

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
const held = { line1: '', line2: '', color: '', tier: -1, age: 0, active: false };
const pulse = { tier: -1, age: 0 }; // highest tier the live combo has crossed

// Called when a combo banks: keep its chain on screen with the result. tier:
// hype tier index or -1.
export function holdCombo(chain, result, color, W, tier = -1) {
  held.line1 = chainText(chain, W);
  held.line2 = result;
  held.color = color;
  held.tier = tier;
  held.age = 0;
  held.active = true;
}

export function updateCombo(dt, cfg, s) {
  if (s.live && s.comboTricks > 0) {
    const tier = hypeTier(comboValue(s), cfg);
    if (tier > pulse.tier) {
      pulse.tier = tier;
      pulse.age = 0;
    } else {
      pulse.age += dt;
    }
  } else {
    pulse.tier = -1;
  }
  if (!held.active) return;
  held.age += dt;
  if (held.age >= cfg.ui.comboHoldTime) held.active = false;
}

export function clearCombo() {
  held.active = false;
  pulse.tier = -1;
}

export function drawCombo(g, W, s, cfg) {
  const cx = W >> 1;
  const shadow = { align: 'center', shadow: COL.ink };
  if (s.live && s.comboTricks > 0) {
    held.active = false;
    const value = comboValue(s);
    if (s.chain.length !== liveLen || value !== livePts) {
      liveLen = s.chain.length;
      livePts = value;
      liveLine1 = chainText(s.chain, W);
      liveLine2 = value + ' x' + multiplier(s);
    }
    drawText(g, liveLine1, cx, COMBO_Y, COL.cream, shadow);
    if (pulse.tier >= 0 && pulse.age < cfg.hype.pulseTime) {
      const col = COL[cfg.hype.tiers[pulse.tier].color];
      drawText(g, liveLine2, cx, COMBO_Y + 10, col, { align: 'center', scale: 2, shadow: COL.ink });
    } else {
      drawText(g, liveLine2, cx, COMBO_Y + 10, COL.gold, shadow);
    }
    return;
  }
  if (!held.active) return;
  // Blink out over the last 20%.
  const hold = cfg.ui.comboHoldTime;
  if (held.age > hold * 0.8 && Math.floor(held.age * 16) % 2 === 1) return;
  drawText(g, held.line1, cx, COMBO_Y, COL.cream, shadow);
  let y = COMBO_Y + 10;
  if (held.tier >= 0) {
    const t = cfg.hype.tiers[held.tier];
    drawText(g, t.word, cx, y, COL[t.color], { align: 'center', scale: 2, shadow: COL.ink });
    y += 18;
  }
  drawText(g, held.line2, cx, y, held.color, shadow);
}

// Big mid-screen banner ("NEW BEST!").
export function drawBanner(g, W, text, color) {
  drawText(g, text, W >> 1, 84, color, { align: 'center', scale: 2, shadow: COL.ink });
}

// Numbers in messages: 4,120.
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

function blinkOn(t, cfg) {
  return Math.floor(t / cfg.ui.blinkPeriod) % 2 === 0;
}

const center = { align: 'center', shadow: COL.ink };

// 75% dither box: dims what's behind (the demo run) enough for text to read,
// but keeps it visible. Ink everywhere except every other pixel of every
// other row.
let dither = null; // pre-rendered once, copied with a single drawImage

function ditherBox(g, x, y, w, h) {
  if (!dither || dither.width < w + 1 || dither.height < h + 1) {
    dither = document.createElement('canvas');
    dither.width = Math.max(w, 400) + 2;
    dither.height = Math.max(h, 180) + 2;
    const d = dither.getContext('2d');
    d.fillStyle = COL.ink;
    for (let yy = 0; yy < dither.height; yy++) {
      if (yy & 1) d.fillRect(0, yy, dither.width, 1);
      else for (let xx = 1; xx < dither.width; xx += 2) d.fillRect(xx, yy, 1, 1);
    }
  }
  // Keep the pattern's phase fixed to the screen so it doesn't shimmer.
  g.drawImage(dither, x & 1, y & 1, w, h, x, y, w, h);
  g.fillStyle = COL.steel;
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
}

// Big-pixel button with a label (hit-test with inRect). active = held down,
// disabled = greyed out.
function drawButton(g, b, label, active, disabled) {
  g.fillStyle = active ? COL.indigo : COL.ink;
  g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = active ? COL.gold : disabled ? COL.slate : COL.steel;
  g.fillRect(b.x, b.y, b.w, 1);
  g.fillRect(b.x, b.y + b.h - 1, b.w, 1);
  g.fillRect(b.x, b.y, 1, b.h);
  g.fillRect(b.x + b.w - 1, b.y, 1, b.h);
  const col = active ? COL.gold : disabled ? COL.slate : COL.cream;
  drawText(g, label, b.x + (b.w >> 1), b.y + ((b.h - 8) >> 1) + 1, col, { align: 'center' });
}

function inRect(b, x, y) {
  return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
}

// --- Boot ----------------------------------------------------------------------

const BOOT_LINES = [
  ['PIXEL GRIND SYSTEM V1.0', ''],
  ['ROM CHECK ........ ', 'OK'],
  ['RAM CHECK ........ ', 'OK'],
  ['SOUND CHIP ....... ', 'OK'],
  ['TOUCH PANEL ...... ', 'OK'],
  ['', ''],
  ['INSERT BOARD', ''],
];

export function drawBootScreen(g, W, H, t, cfg) {
  g.fillStyle = COL.ink;
  g.fillRect(0, 0, W, H);
  const per = cfg.boot.duration / (BOOT_LINES.length + 1);
  const shown = Math.min(BOOT_LINES.length, Math.floor(t / per));
  for (let i = 0; i < shown; i++) {
    const [text, ok] = BOOT_LINES[i];
    const y = 30 + i * 12;
    drawText(g, text, 24, y, i === BOOT_LINES.length - 1 ? COL.gold : COL.mint);
    if (ok) drawText(g, ok, 24 + text.length * 8, y, COL.cream);
  }
  if (Math.floor(t / 0.25) % 2 === 0) {
    g.fillStyle = COL.mint; // blinking cursor
    g.fillRect(24, 30 + shown * 12, 7, 7);
  }
}

// --- Title / attract ---------------------------------------------------------------
// Logo, flashing TAP TO START, and a panel cycling through how-to-play, the
// high-score table and stats, over the bot's demo run. The wallet sits in the
// top-right corner and the SHOP button under the panel.

export const TITLE_PANELS = 3;

export function drawTitleScreen(g, W, H, t, panel, data, pressed, cfg) {
  const cx = W >> 1;
  drawText(g, 'PIXEL GRIND', cx, 10, COL.gold, { align: 'center', scale: 2, shadow: COL.ink });
  drawText(g, '¤' + data.wallet, W - 4, 4, COL.gold, { align: 'right', shadow: COL.ink });
  if (blinkOn(t, cfg)) drawText(g, data.touch ? 'TAP TO START' : 'SPACE OR CLICK TO START', cx, 32, COL.cream, center);

  const bx = cx - 124;
  ditherBox(g, bx, 46, 248, 112);
  let y = 52;
  const line = (text, col = COL.cream) => {
    drawText(g, text, cx, y, col, center);
    y += 11;
  };
  if (panel === 0) {
    line('HOW TO PLAY', COL.rose);
    y += 3;
    line(data.touch ? 'TAP: OLLIE' : 'SPACE: OLLIE', COL.mint);
    line(data.touch ? 'SWIPE FOR A FLIP:' : 'ARROW KEYS FOR A FLIP:');
    line('← KICKFLIP   → HEELFLIP', COL.gold);
    line('↓ SHOVE-IT   ↑ 360 FLIP', COL.gold);
    line('LAND ON RAILS TO GRIND', COL.mint);
    line('KICKERS = 2 FLIPS', COL.mint);
    line('MIX TRICKS FOR A MULTIPLIER');
  } else if (panel === 1) {
    line('HIGH SCORES', COL.rose);
    y -= 1;
    data.scores.forEach((s, i) => {
      const rank = String(i + 1).padStart(2, ' ');
      drawText(g, `${rank}. ${s.name}  ${String(s.score).padStart(6, '0')}`, cx, y, i === 0 ? COL.gold : COL.cream, center);
      y += 9;
    });
  } else {
    const st = data.stats;
    line('STATS', COL.rose);
    y += 6;
    line('RUNS ' + st.runs);
    line('DISTANCE ' + (st.distance / 10000).toFixed(1) + ' KM');
    line('BEST COMBO ' + st.bestCombo);
    line('TRICKS LANDED ' + st.tricks);
    line('COINS COLLECTED ' + st.coins);
  }

  drawButton(g, SHOP_BUTTON(W), 'SHOP', pressed === 'shop');
  if (data.installable) drawButton(g, INSTALL_BUTTON(W), 'INSTALL', pressed === 'install');
  drawText(g, 'BUILD ' + data.build, W - 4, H - 10, COL.steel, { align: 'right' });
}

const SHOP_BUTTON = (W) => ({ x: (W >> 1) - 36, y: 161, w: 72, h: 17 });
// Shown on the title screen when the browser offers installing the app (M8).
const INSTALL_BUTTON = (W) => ({ x: 4, y: 162, w: 64, h: 14 });

export function titleButtonAt(x, y, W, installable) {
  if (inRect(SHOP_BUTTON(W), x, y)) return 'shop';
  return installable && inRect(INSTALL_BUTTON(W), x, y) ? 'install' : null;
}

// --- Tutorial prompt -------------------------------------------------------------

export function drawPrompt(g, W, lines) {
  for (let i = 0; i < lines.length; i++) drawText(g, lines[i], W >> 1, 22 + i * 10, COL.gold, center);
}

// --- Countdown after a pause -------------------------------------------------------

export function drawCountdown(g, W, label) {
  drawText(g, label, W >> 1, 64, COL.gold, { align: 'center', scale: 2, shadow: COL.ink });
}

// --- Initials entry --------------------------------------------------------------
// Swipe up / down to change the letter, tap to confirm it.

export function drawInitialsScreen(g, W, H, t, entry, touch, sprites) {
  const cx = W >> 1;
  g.drawImage(sprites.checker, 0, 0);
  drawText(g, entry.rank === 0 ? 'NEW HIGH SCORE!' : 'TOP 10!', cx, 24, COL.gold, { align: 'center', scale: 2, shadow: COL.ink });
  drawText(g, `RANK ${entry.rank + 1}   SCORE ${entry.score}`, cx, 50, COL.cream, center);
  drawText(g, 'ENTER YOUR INITIALS', cx, 66, COL.mint, center);
  for (let i = 0; i < 3; i++) {
    const x = cx - 40 + i * 32;
    const active = i === entry.cursor;
    if (active) {
      g.fillStyle = COL.indigo;
      g.fillRect(x - 3, 84, 22, 22);
      if (Math.floor(t / 0.3) % 2 === 0) {
        drawText(g, '↑', x + 4, 74, COL.gold);
        drawText(g, '↓', x + 4, 108, COL.gold);
      }
    }
    const ch = String.fromCharCode(65 + entry.letters[i]);
    drawText(g, ch, x + 1, 87, i < entry.cursor ? COL.mint : active ? COL.gold : COL.cream, { scale: 2, shadow: COL.ink });
  }
  drawText(g, touch ? 'SWIPE ↑↓ TO CHANGE   TAP: OK' : '↑↓ TO CHANGE   SPACE: OK', cx, 126, COL.steel, center);
}

// --- Game over -----------------------------------------------------------------

// By bail reason: obstacle type (city skin names), 'gap' or 'flip'.
const BAIL_REASON = {
  lowBlock: 'HIT A CONE',
  tallBlock: 'HIT A TRASH CAN',
  ledge: 'HIT A LEDGE',
  rail: 'HIT A RAIL',
  gap: 'FELL IN A HOLE',
  flip: 'LANDED MID-FLIP',
};

const GAMEOVER_BUTTONS = (W) => ({
  share: { x: (W >> 1) - 103, y: 128, w: 64, h: 16 },
  shop: { x: (W >> 1) - 32, y: 128, w: 64, h: 16 },
  title: { x: (W >> 1) + 39, y: 128, w: 64, h: 16 },
});

export function gameOverButtonAt(x, y, W) {
  const b = GAMEOVER_BUTTONS(W);
  for (const name of ['share', 'shop', 'title']) if (inRect(b[name], x, y)) return name;
  return null;
}

// Under the score, in this order; lines that don't apply are left out (up to
// 7 fit). result: { score, bestCombo, distance (px), coins, wallet, best (the
// #1 score before this run), reason, rank (-1 = not in top 10), msg }
function gameOverLines(r) {
  const lines = [];
  if (r.score > r.best) lines.push(['NEW BEST BY ' + fmt(r.score - r.best), COL.gold]);
  else if (r.score === r.best) lines.push(['TIED YOUR BEST', COL.cream]);
  else lines.push([fmt(r.best - r.score) + ' SHORT OF YOUR BEST', COL.steel]);
  lines.push([`BEST COMBO ${r.bestCombo}   DISTANCE ${Math.floor(r.distance / 10)}M`, COL.cream]);
  lines.push([`COINS +${r.coins}   WALLET ¤${r.wallet}`, COL.gold]);
  // Rank 1 is already announced by NEW BEST.
  if (r.rank > 0) lines.push(['RANK ' + (r.rank + 1) + ' OF 10', COL.gold]);
  return lines;
}

export function drawGameOverScreen(g, W, H, t, result, canRetry, touch, pressed, sprites, cfg) {
  const cx = W >> 1;
  g.drawImage(sprites.checker, 0, 0);
  drawText(g, 'GAME OVER', cx, 6, COL.rose, { align: 'center', scale: 2, shadow: COL.ink });
  drawText(g, BAIL_REASON[result.reason] || '', cx, 25, COL.steel, center);
  drawText(g, 'SCORE ' + fmt(result.score), cx, 36, COL.cream, center);
  let y = 47;
  for (const [text, col] of gameOverLines(result)) {
    drawText(g, text, cx, y, col, center);
    y += 10;
  }
  if (result.msg) drawText(g, result.msg, cx, 117, COL.mint, center);
  const b = GAMEOVER_BUTTONS(W);
  drawButton(g, b.share, 'SHARE', pressed === 'share');
  drawButton(g, b.shop, 'SHOP', pressed === 'shop');
  drawButton(g, b.title, 'TITLE', pressed === 'title');
  if (canRetry && blinkOn(t, cfg)) drawText(g, touch ? 'TAP TO RETRY' : 'SPACE TO RETRY', cx, 156, COL.gold, center);
}

// --- Shop ------------------------------------------------------------------------
// Left: the skater in the selected item, drawn at 2x (the only scaled drawing
// in the game), with its name and BACK. Right: the wallet, a tab per gear
// slot, the slot's items (each on a mini skater, with its price) and the
// BUY / EQUIP button.

const SHOP_W = 214; // right panel width

function shopLayout(W) {
  const x0 = W - SHOP_W - 4;
  return {
    x0,
    tab: (i) => ({ x: x0 + i * 54, y: 22, w: 52, h: 16 }),
    tile: (i) => ({ x: x0 + (i % 4) * 54, y: 42 + Math.floor(i / 4) * 44, w: 52, h: 40 }),
    action: { x: x0, y: 133, w: SHOP_W, h: 20 },
    back: { x: 4, y: 160, w: 60, h: 16 },
  };
}

// 'tab:N', 'item:N', 'action', 'back' or null.
export function shopHitAt(x, y, W, tabs, items) {
  const L = shopLayout(W);
  for (let i = 0; i < tabs; i++) if (inRect(L.tab(i), x, y)) return 'tab:' + i;
  for (let i = 0; i < items; i++) if (inRect(L.tile(i), x, y)) return 'item:' + i;
  if (inRect(L.action, x, y)) return 'action';
  if (inRect(L.back, x, y)) return 'back';
  return null;
}

// v: { tabs: [label], tab, items: [{ name, price, owned, worn, tile }], sel,
// wallet, preview (skater frames), action: { label, disabled }, msg, pressed }
export function drawShopScreen(g, W, H, t, v, sprites, cfg) {
  const L = shopLayout(W);
  const lx = L.x0 >> 1; // left panel centre
  g.drawImage(sprites.checker, 0, 0);
  drawText(g, 'SHOP', lx, 4, COL.gold, { align: 'center', scale: 2, shadow: COL.ink });
  drawText(g, '¤' + v.wallet, W - 4, 8, COL.gold, { align: 'right', shadow: COL.ink });

  // Preview stage: rides, then shows a kickflip (the board's underside).
  g.fillStyle = COL.ink;
  g.fillRect(6, 28, L.x0 - 12, 122);
  g.fillStyle = COL.slate;
  g.fillRect(6, 28, L.x0 - 12, 1);
  g.fillRect(6, 149, L.x0 - 12, 1);
  const groundY = 112;
  g.fillRect(lx - 28, groundY, 56, 2);
  const s = cfg.shop;
  const ct = t % (s.previewRide + s.previewFlip);
  let img;
  let hop = 0;
  if (ct < s.previewRide) {
    img = v.preview.ride[Math.floor(t / cfg.ui.rollFrameTime) & 1];
  } else {
    const f = (ct - s.previewRide) / s.previewFlip;
    const frames = v.preview.flips.kickflip;
    img = frames[Math.min(frames.length - 1, Math.floor(f * frames.length))];
    hop = Math.round(Math.sin(f * Math.PI) * s.previewHop);
  }
  g.drawImage(img, lx - 16, groundY - 48 - hop * 2, 32, 48);
  const it = v.items[v.sel];
  drawText(g, it.name, lx, 122, COL.cream, center);
  const status = it.worn ? 'EQUIPPED' : it.owned ? 'OWNED' : '¤' + it.price;
  drawText(g, status, lx, 134, it.worn ? COL.mint : it.owned ? COL.cream : COL.gold, center);

  for (let i = 0; i < v.tabs.length; i++) drawButton(g, L.tab(i), v.tabs[i], i === v.tab);

  for (let i = 0; i < v.items.length; i++) {
    const e = v.items[i];
    const b = L.tile(i);
    const sel = i === v.sel;
    g.fillStyle = sel ? COL.indigo : COL.ink;
    g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = sel ? COL.gold : COL.slate;
    g.fillRect(b.x, b.y, b.w, 1);
    g.fillRect(b.x, b.y + b.h - 1, b.w, 1);
    g.fillRect(b.x, b.y, 1, b.h);
    g.fillRect(b.x + b.w - 1, b.y, 1, b.h);
    g.drawImage(e.tile, b.x + 18, b.y + 3);
    const label = e.worn ? 'ON' : e.owned ? 'OWNED' : '¤' + e.price;
    const col = e.worn ? COL.mint : e.owned ? COL.cream : e.price <= v.wallet ? COL.gold : COL.steel;
    drawText(g, label, b.x + (b.w >> 1), b.y + 30, col, { align: 'center' });
  }

  drawButton(g, L.action, v.action.label, v.pressed === 'action', v.action.disabled);
  drawButton(g, L.back, 'BACK', v.pressed === 'back');
  if (v.msg) drawText(g, v.msg.text, L.x0 + (SHOP_W >> 1), 160, v.msg.color, center);
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
