// Fixed-timestep loop and the state machine.
// States: start -> play -> dead -> play ..., plus paused.
// Portrait on a phone overrides everything with the rotate screen.

import { CONFIG } from './config.js';
import { randomSeed } from './rng.js';
import { createInput } from './input.js';
import { createRenderer, drawWorld } from './render.js';
import { buildSprites, COL } from './sprites.js';
import { createRun, runPress, runFlip, stepRun } from './run.js';
import {
  drawHud,
  drawStartScreen,
  drawDeadScreen,
  drawPausedScreen,
  drawRotateScreen,
  addPopup,
  clearPopups,
  updatePopups,
  drawPopups,
} from './ui.js';
import { createDebug, drawHitboxes, reportError } from './debug.js';
import { isPortrait, isTouchDevice, enterFullscreenLandscape } from './device.js';
import { unlockAudio } from './audio.js';
import { createTuningPanel } from './tuning.js';
import { TRICK_NAMES } from './tricks.js';

/* global __BUILD_ID__ */
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'DEV';
const STEP = 1 / CONFIG.loop.hz;
const REFRESH_INTERVALS = [1 / 30, 1 / 60, 1 / 90, 1 / 120, 1 / 144];

const params = new URLSearchParams(location.search);
const urlSeed = params.has('seed') ? Number.parseInt(params.get('seed'), 10) >>> 0 : null;

const renderer = createRenderer(CONFIG, document.getElementById('screen'), document.getElementById('stage'));
const sprites = buildSprites(CONFIG);
const input = createInput(CONFIG);
const debug = createDebug(CONFIG, params.get('debug') === '1');

const game = {
  state: 'start',
  stateTime: 0,
  time: 0, // s, drives UI animation
  armed: false, // a press seen in a menu state; the matching release confirms
  portrait: false,
  touch: isTouchDevice(),
  run: createRun(CONFIG, CONFIG.attract.seed, { spawn: false }),
};

function setState(s) {
  game.state = s;
  game.stateTime = 0;
  game.armed = false;
}

function startRun() {
  game.run = createRun(CONFIG, urlSeed ?? randomSeed(), { spawn: true });
  clearPopups();
  setState('play');
}

function pause() {
  if (game.state === 'play') setState('paused');
}

function resume() {
  if (game.state === 'paused') setState('play');
}

// Opening the panel pauses; tap the game area to play on with it open.
const tuning = createTuningPanel(CONFIG, { onOpen: pause });
tuning.setButtonVisible(debug.enabled);

function handleRunEvents(run) {
  const evs = run.events;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (e.type === 'trick') {
      addPopup(TRICK_NAMES[e.trick], COL.gold);
    } else if (e.type === 'land' && e.flips > 0) {
      if (e.result === 'sketchy') addPopup('SKETCHY! +' + e.points, COL.orange);
      else addPopup('+' + e.points, COL.mint);
    }
  }
  evs.length = 0;
}

function handleAction(a) {
  if (a === 'debug') {
    debug.toggle();
    tuning.setButtonVisible(debug.enabled);
    return;
  }
  if (a === 'tune') {
    if (debug.enabled) tuning.toggle();
    return;
  }
  if (a === 'pause') {
    if (game.state === 'play') pause();
    else if (game.state === 'paused' && !game.portrait) resume();
    return;
  }
  if (game.portrait) return;

  if (game.state === 'play') {
    if (a === 'press') runPress(game.run, CONFIG); // ollie on touch-down, same tick
    else if (a.startsWith('flip')) runFlip(game.run, a, CONFIG);
    return;
  }

  // Menu states confirm on release, after a press that happened inside this
  // state. Release is when touch grants fullscreen permission, and a finger
  // already down when the state changed can't skip the screen. Flips do nothing.
  if (a === 'press') {
    const lockout = game.state === 'dead' ? CONFIG.bail.retryDelay : 0;
    if (game.stateTime >= lockout) game.armed = true;
  } else if (a === 'release' && game.armed) {
    if (game.state === 'paused') resume();
    else startRun();
  }
}

function tick(dt) {
  game.time += dt;
  game.stateTime += dt;
  const actions = input.drain();
  for (let i = 0; i < actions.length; i++) handleAction(actions[i]);
  if (game.portrait) return;

  switch (game.state) {
    case 'start':
      stepRun(game.run, dt, CONFIG);
      break;
    case 'dead':
      stepRun(game.run, dt, CONFIG);
      updatePopups(dt, CONFIG);
      break;
    case 'play':
      stepRun(game.run, dt, CONFIG);
      updatePopups(dt, CONFIG);
      if (game.run.over) setState('dead');
      break;
    // 'paused': frozen
  }
  handleRunEvents(game.run);
}

function render() {
  const g = renderer.g;
  const W = renderer.width;
  const H = renderer.height;

  if (game.portrait) {
    drawRotateScreen(g, W, H, game.time, CONFIG);
  } else {
    drawWorld(g, W, game.run, sprites, CONFIG);
    if (debug.enabled) drawHitboxes(g, W, game.run);
    if (game.state === 'start') {
      drawStartScreen(g, W, H, game.time, game.touch, BUILD, CONFIG);
    } else {
      drawHud(g, W, game.run.score);
      drawPopups(g, W, CONFIG);
      if (game.state === 'dead') {
        const canRetry = game.stateTime >= CONFIG.bail.retryDelay;
        const run = game.run;
        drawDeadScreen(g, W, H, game.stateTime, run.score, run.bailReason, canRetry, game.touch, sprites, CONFIG);
      } else if (game.state === 'paused') {
        drawPausedScreen(g, W, H, game.stateTime, game.touch, sprites, CONFIG);
      }
    }
  }
  if (debug.enabled) debug.draw(g, W, debugLines);
  renderer.present();
}

function debugLines(d) {
  const run = game.run;
  const p = run.player;
  const flip = p.flip ? `${p.flip.toUpperCase()} ${p.flipTime.toFixed(2)}/${p.flipDur.toFixed(2)}` : '-';
  const lines = [
    `FPS ${d.fps.toFixed(0)} FT ${d.ft.toFixed(1)} MAX ${d.ftMax.toFixed(1)}`,
    `CPU ${d.cpu.toFixed(2)} MAX ${d.cpuMax.toFixed(2)}`,
    `RES ${renderer.width}X${renderer.height} ${renderer.scale}X DPR ${renderer.dpr.toFixed(2)}`,
    `SPD ${run.world.speed.toFixed(0)} DIST ${run.world.distance.toFixed(0)}`,
    `FLIP ${flip} Q ${p.queued ? p.queued.toUpperCase() : '-'}`,
    `TIER - SEG -`,
    `SEED ${run.seed}`,
    `STATE ${game.state.toUpperCase()}`,
    `BUILD ${BUILD}`,
  ];
  const tuned = tuning.changedCount();
  if (tuned > 0) lines.push(`TUNED ${tuned} VALUES`);
  return lines;
}

// --- Loop -------------------------------------------------------------------

function snap(dt) {
  for (let i = 0; i < REFRESH_INTERVALS.length; i++) {
    if (Math.abs(dt - REFRESH_INTERVALS[i]) < CONFIG.loop.vsyncSnap) return REFRESH_INTERVALS[i];
  }
  return dt;
}

function checkPortrait() {
  const portrait = isPortrait();
  if (portrait !== game.portrait) {
    game.portrait = portrait;
    if (portrait) pause();
  }
}

let last = -1;
let acc = 0;
let halted = false;

function frame(now) {
  if (halted) return;
  requestAnimationFrame(frame);
  try {
    if (last < 0) last = now;
    let dt = (now - last) / 1000;
    last = now;
    debug.frame(dt);
    if (dt > CONFIG.loop.maxFrameTime) dt = CONFIG.loop.maxFrameTime;
    if (dt < 0) dt = 0;
    acc += snap(dt);
    checkPortrait();

    const t0 = performance.now();
    while (acc >= STEP - 1e-9) {
      tick(STEP);
      acc -= STEP;
    }
    render();
    debug.work(performance.now() - t0);
  } catch (err) {
    // Stop on the first error so the error box shows the cause, not a flood.
    halted = true;
    reportError(err);
  }
}

// --- Platform hooks ---------------------------------------------------------

input.onGesture = () => {
  unlockAudio();
  if (game.touch && game.state !== 'play') enterFullscreenLandscape();
};
window.addEventListener('touchend', unlockAudio, { passive: true });

// Auto-pause when the player leaves (resume countdown comes in M6).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);
window.addEventListener('pagehide', pause);

// Console hook in debug mode: step the simulation by hand, inspect state.
if (debug.enabled) {
  window.__pixelGrind = {
    game,
    config: CONFIG,
    tuning,
    step(n = 1) {
      checkPortrait();
      for (let i = 0; i < n; i++) tick(STEP);
      render();
    },
  };
}

requestAnimationFrame(frame);
