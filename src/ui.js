// HUD and full-screen prompts (title, bail, pause, rotate).

import { drawText } from './font.js';
import { COL } from './sprites.js';

let hudScore = -1;
let hudText = '';

export function drawHud(g, W, score) {
  if (score !== hudScore) {
    hudScore = score;
    hudText = String(score).padStart(6, '0');
  }
  drawText(g, hudText, 4, 4, COL.cream, { shadow: COL.ink });
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
  drawText(g, touch ? 'TAP TO OLLIE THE CONES' : 'SPACE TO OLLIE THE CONES', cx, 100, COL.mint, { align: 'center', shadow: COL.ink });
  drawText(g, 'BUILD ' + build, W - 4, H - 10, COL.steel, { align: 'right' });
}

export function drawDeadScreen(g, W, H, t, score, canRetry, touch, sprites, cfg) {
  const cx = W >> 1;
  g.drawImage(sprites.checker, 0, 0);
  drawText(g, 'BAIL!', cx, 44, COL.rose, { align: 'center', scale: 2, shadow: COL.ink });
  drawText(g, 'SCORE ' + score, cx, 72, COL.cream, { align: 'center', shadow: COL.ink });
  if (canRetry && blinkOn(t, cfg)) {
    drawText(g, touch ? 'TAP TO RETRY' : 'SPACE TO RETRY', cx, 96, COL.gold, { align: 'center', shadow: COL.ink });
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
