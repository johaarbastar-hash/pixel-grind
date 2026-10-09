// Fixed-timestep loop and the state machine.
// States: start -> play -> dead -> play ..., plus paused.
// Portrait on a phone overrides everything with the rotate screen.

import { CONFIG } from './config.js';
import { randomSeed } from './rng.js';
import { createInput } from './input.js';
import { createRenderer, drawWorld } from './render.js';
import { buildSprites, COL } from './sprites.js';
import { createRun, cloneRun, runPress, runFlip, stepRun } from './run.js';
import {
  drawHud,
  drawStartScreen,
  drawGameOverScreen,
  drawCombo,
  hitPauseButton,
  drawPausedScreen,
  drawRotateScreen,
  drawPrompt,
  addPopup,
  clearPopups,
  updatePopups,
  drawPopups,
} from './ui.js';
import { createDebug, drawHitboxes, reportError } from './debug.js';
import { isPortrait, isTouchDevice, enterFullscreenLandscape } from './device.js';
import { unlockAudio } from './audio.js';
import { createTuningPanel } from './tuning.js';
import { SEGMENTS } from './segments.js';
import { TUTORIAL, tutorialPrompt } from './tutorial.js';
import { createBot } from './bot.js';
import { getSetting, setSetting } from './storage.js';

/* global __BUILD_ID__ */
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'DEV';
const STEP = 1 / CONFIG.loop.hz;
const REFRESH_INTERVALS = [1 / 30, 1 / 60, 1 / 90, 1 / 120, 1 / 144];

// URL options: ?debug=1 overlay, ?seed=N fixed seed, ?tutorial=1 force the
// tutorial, ?bot=1 autopilot. Soak-test replays: ?tier=T&speed=V&seg=ID
// (fixed tier / speed, repeat one segment, skip the opening).
const params = new URLSearchParams(location.search);
const intParam = (name) => (params.has(name) ? Number.parseInt(params.get(name), 10) || 0 : 0);
const urlSeed = params.has('seed') ? Number.parseInt(params.get('seed'), 10) >>> 0 : null;
const urlSpeed = intParam('speed');
const urlSeg = params.get('seg');
const replay = !!(params.has('tier') || urlSpeed || urlSeg);

const renderer = createRenderer(CONFIG, document.getElementById('screen'), document.getElementById('stage'));
const sprites = buildSprites(CONFIG);
const input = createInput(CONFIG);
const debug = createDebug(CONFIG, params.get('debug') === '1');
const bot = createBot(CONFIG, { flips: true });

// Debug toggles (tuning panel and URL).
const dbg = {
  invincible: false,
  slowmo: false,
  autopilot: params.get('bot') === '1',
  tier: Math.max(0, Math.min(4, intParam('tier'))), // 0 = by run time
  repeatSeg: urlSeg,
  segPick: SEGMENTS[0].id,
};

const game = {
  state: 'start',
  stateTime: 0,
  time: 0, // s, drives UI animation
  armed: false, // a press seen in a menu state; the matching release confirms
  portrait: false,
  touch: isTouchDevice(),
  run: createRun(CONFIG, CONFIG.attract.seed, { spawn: false }),
  tutorial: null, // { snap, cp, retry } while the tutorial runs
  best: getSetting('best', 0), // hi-score (top-10 table comes in M6)
};

function setState(s) {
  game.state = s;
  game.stateTime = 0;
  game.armed = false;
}

function applyDebug(run) {
  run.invincible = dbg.invincible;
  run.world.tierOverride = dbg.tier;
  if (dbg.repeatSeg) run.world.forceNext = dbg.repeatSeg;
}

function setRun(run) {
  game.run = run;
  applyDebug(run);
  bot.reset();
  clearPopups();
}

function startRun() {
  const tutorial = params.get('tutorial') === '1' || (!replay && !getSetting('tutorialDone', false));
  const run = createRun(CONFIG, urlSeed ?? randomSeed(), { spawn: true, script: tutorial ? TUTORIAL : null });
  if (replay) run.world.nextSpawnX = CONFIG.view.maxWidth + 40; // straight to the action, like the soak test
  if (urlSpeed) run.world.speedOverride = urlSpeed;
  setRun(run);
  game.tutorial = tutorial ? { snap: cloneRun(run, CONFIG), cp: 0, retry: 0 } : null;
  setState('play');
}

function gameOver() {
  if (game.run.score > game.best) {
    game.best = game.run.score;
    setSetting('best', game.best);
  }
  setState('dead');
}

function pause() {
  if (game.state === 'play') setState('paused');
}

function resume() {
  if (game.state === 'paused') setState('play');
}

// Tutorial: save a checkpoint as each one is passed; a bail rewinds to the
// last one instead of ending the run (no boards lost).
function updateTutorial(dt) {
  const tut = game.tutorial;
  const run = game.run;
  if (run.down) {
    tut.retry += dt;
    if (tut.retry >= CONFIG.tutorial.retryDelay) {
      setRun(cloneRun(tut.snap, CONFIG));
      addPopup('TRY AGAIN', COL.cream);
      tut.retry = 0;
    }
    return;
  }
  const d = run.world.distance;
  const cps = TUTORIAL.checkpoints;
  const p = run.player;
  if (tut.cp + 1 < cps.length && d >= cps[tut.cp + 1] && p.onGround && !p.ramp) {
    tut.cp++;
    tut.snap = cloneRun(run, CONFIG);
  }
  if (d >= TUTORIAL.length) {
    setSetting('tutorialDone', true);
    game.tutorial = null;
  }
}

// Opening the panel pauses; tap the game area to play on with it open.
const tuning = createTuningPanel(CONFIG, {
  onOpen: pause,
  controls: [
    { type: 'check', label: 'invincible', get: () => dbg.invincible, set: (v) => (dbg.invincible = v) },
    { type: 'check', label: 'slow motion', get: () => dbg.slowmo, set: (v) => (dbg.slowmo = v) },
    {
      type: 'check',
      label: 'autopilot',
      get: () => dbg.autopilot,
      set: (v) => {
        dbg.autopilot = v;
        bot.reset();
      },
    },
    {
      type: 'select',
      label: 'tier',
      options: [[0, 'by run time'], [1, '1'], [2, '2'], [3, '3'], [4, '4']],
      get: () => dbg.tier,
      set: (v) => (dbg.tier = Number(v)),
    },
    {
      type: 'select',
      label: 'segment',
      options: SEGMENTS.map((s) => [s.id, `${s.id} (tier ${s.tier})`]),
      get: () => dbg.segPick,
      set: (v) => (dbg.segPick = v),
    },
    { type: 'button', label: 'SPAWN SEGMENT NEXT', onClick: () => (game.run.world.forceNext = dbg.segPick) },
    {
      type: 'button',
      label: 'TUTORIAL ON NEXT RUN',
      onClick: () => setSetting('tutorialDone', false),
    },
  ],
});
tuning.setButtonVisible(debug.enabled);

function handleRunEvents(run) {
  const evs = run.events;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    // Trick names show in the combo chain (drawCombo); popups are for results.
    if (e.type === 'bail' && !run.over) {
      addPopup('BAIL!', COL.rose);
    } else if (e.type === 'extraBoard') {
      addPopup('EXTRA BOARD!', COL.mint);
    } else if (e.type === 'land' && e.tricks > 0) {
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
    case 'play': {
      applyDebug(game.run);
      if (dbg.autopilot) {
        const a = bot.decide(game.run);
        if (a) handleAction(a);
      }
      stepRun(game.run, dt, CONFIG);
      updatePopups(dt, CONFIG);
      if (game.tutorial) updateTutorial(dt);
      else if (game.run.over && game.run.downTime >= CONFIG.bail.gameOverDelay) gameOver();
      break;
    }
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
    const run = game.run;
    drawWorld(g, W, run, sprites, CONFIG);
    if (debug.enabled) drawHitboxes(g, W, run);
    if (game.state === 'start') {
      drawStartScreen(g, W, H, game.time, game.touch, BUILD, CONFIG);
    } else {
      drawHud(g, W, run, game.best, sprites);
      drawCombo(g, W, run.tricks);
      if (game.tutorial && !run.down) {
        const text = tutorialPrompt(run.world.distance, game.touch);
        if (text) drawPrompt(g, W, text);
      }
      drawPopups(g, W, CONFIG);
      if (game.state === 'dead') {
        const canRetry = game.stateTime >= CONFIG.bail.retryDelay;
        drawGameOverScreen(g, W, H, game.stateTime, run, canRetry, game.touch, sprites, CONFIG);
      } else if (game.state === 'paused') {
        drawPausedScreen(g, W, H, game.stateTime, game.touch, sprites, CONFIG);
      }
    }
  }
  if (debug.enabled) debug.draw(g, W, debugLines);
  renderer.present();
}

function segmentAhead(run) {
  const x = run.world.distance + CONFIG.world.skaterX;
  for (const ob of run.world.obstacles) if (ob.x + ob.w > x) return ob.seg || '-';
  return '-';
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
    `TIER ${run.world.tier} SEG ${segmentAhead(run).toUpperCase()}`,
    `BOARDS ${run.boards} TOKENS ${run.tokenPoints / CONFIG.tokens.points} INV ${run.invuln.toFixed(1)}`,
    `SEED ${run.seed}`,
    `STATE ${game.state.toUpperCase()}${game.tutorial ? ' TUTORIAL' : ''}`,
    `BUILD ${BUILD}`,
  ];
  const flags = [dbg.autopilot && 'BOT', dbg.invincible && 'INVINCIBLE', dbg.slowmo && 'SLOW-MO'].filter(Boolean);
  if (flags.length) lines.push(flags.join(' '));
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
    acc += snap(dt) * (dbg.slowmo ? CONFIG.debug.slowMotion : 1);
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

input.uiHitTest = (clientX, clientY) => {
  if (game.state !== 'play' || game.portrait) return null;
  const p = renderer.toInternal(clientX, clientY);
  return hitPauseButton(p.x, p.y, renderer.width) ? 'pause' : null;
};

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
    dbg,
    step(n = 1) {
      checkPortrait();
      for (let i = 0; i < n; i++) tick(STEP);
      render();
    },
  };
}

requestAnimationFrame(frame);
