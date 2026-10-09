// Fixed-timestep loop and the state machine.
// States: boot -> start (title + demo run) -> play <-> paused -> countdown ->
// play ... -> initials (top 10 only) -> gameover -> play / start.
// Portrait on a phone overrides everything with the rotate screen.

import { CONFIG } from './config.js';
import { randomSeed } from './rng.js';
import { createInput } from './input.js';
import { createRenderer, drawWorld, createParticles } from './render.js';
import { buildSprites, COL } from './sprites.js';
import { createRun, cloneRun, runPress, runFlip, stepRun } from './run.js';
import {
  drawHud,
  drawBootScreen,
  drawTitleScreen,
  titleButtonAt,
  TITLE_PANELS,
  drawGameOverScreen,
  gameOverButtonAt,
  drawInitialsScreen,
  drawCountdown,
  drawCombo,
  holdCombo,
  updateCombo,
  clearCombo,
  hitPauseButton,
  drawPauseMenu,
  pauseMenuItemAt,
  drawRotateScreen,
  drawPrompt,
  addPopup,
  clearPopups,
  updatePopups,
  drawPopups,
} from './ui.js';
import { createDebug, drawHitboxes, reportError } from './debug.js';
import { isPortrait, isTouchDevice, enterFullscreenLandscape } from './device.js';
import {
  configureAudio,
  unlockAudio,
  playSfx,
  startMusic,
  stopMusic,
  restartMusic,
  setMusicTier,
  grindLoop,
  setMuted,
  isMuted,
  suspendAudio,
  resumeAudio,
  audioState,
  vibrate,
  SOUNDS,
} from './audio.js';
import { createTuningPanel } from './tuning.js';
import { SEGMENTS } from './segments.js';
import { TUTORIAL, tutorialPrompt } from './tutorial.js';
import { createBot } from './bot.js';
import { getSetting, setSetting, getScores, scoreRank, addScore, getStats, recordRun } from './storage.js';

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

const crtEl = document.getElementById('crt');
const renderer = createRenderer(CONFIG, document.getElementById('screen'), document.getElementById('stage'), crtEl);
const parts = createParticles(CONFIG.render.particles);
const sprites = buildSprites(CONFIG);
const input = createInput(CONFIG);
const debug = createDebug(CONFIG, params.get('debug') === '1');
configureAudio(CONFIG, { muted: getSetting('muted', false) });
const bot = createBot(CONFIG, { flips: true }); // debug autopilot
const demoBot = createBot(CONFIG, { flips: true, seed: 3, budget: CONFIG.attract.botBudget });

// Debug toggles (tuning panel and URL).
const dbg = {
  invincible: false,
  slowmo: false,
  autopilot: params.get('bot') === '1',
  tier: Math.max(0, Math.min(4, intParam('tier'))), // 0 = by run time
  repeatSeg: urlSeg,
  segPick: SEGMENTS[0].id,
};

// Fake boot text once per browser session.
function bootedThisSession() {
  try {
    return sessionStorage.getItem('pixel-grind.booted') === '1';
  } catch {
    return false;
  }
}

const game = {
  state: 'boot',
  stateTime: 0,
  time: 0, // s, drives UI animation
  armed: false, // a press seen in a menu state; the matching release confirms
  portrait: false,
  touch: isTouchDevice(),
  run: null,
  demoTime: 0, // s the title-screen demo run has been going
  tutorial: null, // { snap, cp, retry } while the tutorial runs
  best: 0, // top of the high-score table, for the HUD
  menuSel: 0, // pause menu selection
  countdown: -1, // last number shown in the countdown
  result: null, // game-over summary
  entry: null, // initials being entered
  pressed: null, // game-over / title button held down
  titleData: null, // scores and stats for the title panels
  installPrompt: null, // Android install prompt, when the browser offers one (M8)
  flash: 0, // frames of white flash left (big combos)
  crt: null, // overlay currently shown
};

function setState(s) {
  game.state = s;
  game.stateTime = 0;
  game.armed = false;
  game.pressed = null;
}

function refreshScores() {
  game.best = getScores()[0].score;
  game.titleData = {
    touch: game.touch,
    build: BUILD,
    scores: getScores(),
    stats: getStats(),
    installable: !!game.installPrompt,
  };
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
  clearCombo();
  parts.clear();
}

// --- Title and demo run ------------------------------------------------------------

// The bot plays a fixed-seed run behind the title. Invincible as a safety net,
// so the demo never dies even if a plan fails.
function newDemoRun() {
  const run = createRun(CONFIG, CONFIG.attract.seed, { spawn: true });
  run.world.nextSpawnX = CONFIG.view.maxWidth + 40;
  setRun(run);
  run.invincible = true;
  demoBot.reset();
  game.demoTime = 0;
}

function toTitle() {
  try {
    sessionStorage.setItem('pixel-grind.booted', '1');
  } catch {
    // no session storage: boot shows again next time, that's all
  }
  game.tutorial = null;
  stopMusic();
  grindLoop(false);
  newDemoRun();
  refreshScores();
  setState('start');
}

function updateDemo(dt) {
  const run = game.run;
  const a = demoBot.decide(run);
  if (a === 'press') runPress(run, CONFIG);
  else if (a) runFlip(run, a, CONFIG);
  stepRun(run, dt, CONFIG);
  grindSparks(run);
  parts.update(dt);
  game.demoTime += dt;
  if (run.over || game.demoTime > CONFIG.attract.restartAfter) newDemoRun();
}

// --- Runs ------------------------------------------------------------------------

function startRun(forceTutorial = false) {
  const tutorial = forceTutorial || params.get('tutorial') === '1' || (!replay && !getSetting('tutorialDone', false));
  const run = createRun(CONFIG, urlSeed ?? randomSeed(), { spawn: true, script: tutorial ? TUTORIAL : null });
  if (replay) run.world.nextSpawnX = CONFIG.view.maxWidth + 40; // straight to the action, like the soak test
  if (urlSpeed) run.world.speedOverride = urlSpeed;
  setRun(run);
  game.tutorial = tutorial ? { snap: cloneRun(run, CONFIG), cp: 0, retry: 0 } : null;
  refreshScores();
  setState('play');
  playSfx('select');
  restartMusic();
  startMusic();
}

function gameOver() {
  stopMusic();
  grindLoop(false);
  const run = game.run;
  recordRun({ distance: run.world.distance, bestCombo: run.tricks.best, tricks: run.tricks.landed });
  const rank = scoreRank(run.score);
  game.result = {
    score: run.score,
    bestCombo: run.tricks.best,
    distance: run.world.distance,
    reason: run.bailReason,
    rank,
    msg: null,
  };
  if (rank >= 0) {
    playSfx('fanfare');
    const last = getSetting('lastInitials', 'AAA');
    game.entry = {
      letters: [...last].map((c) => Math.max(0, Math.min(25, c.charCodeAt(0) - 65))),
      cursor: 0,
      rank,
      score: run.score,
    };
    setState('initials');
  } else {
    playSfx('gameOver');
    setState('gameover');
  }
}

// --- Pause, countdown ----------------------------------------------------------------
// Music and the grind loop stop on pause, bail and game over.

function pause() {
  if (game.state !== 'play' && game.state !== 'countdown') return;
  setState('paused');
  game.menuSel = 0;
  stopMusic();
  grindLoop(false);
}

// Resuming goes through a 3-2-1 countdown.
function resume() {
  if (game.state !== 'paused') return;
  setState('countdown');
  game.countdown = -1;
}

function updateCountdown() {
  const step = CONFIG.countdown.step;
  const n = 3 - Math.floor(game.stateTime / step);
  if (n <= 0) {
    setState('play');
    playSfx('countdown', { go: true });
    addPopup('GO!', COL.gold);
    if (!game.run.down) startMusic();
    if (game.run.player.grinding) grindLoop(true);
    return;
  }
  if (n !== game.countdown) {
    game.countdown = n;
    playSfx('countdown');
  }
}

function toggleMute() {
  setMuted(!isMuted());
  setSetting('muted', isMuted());
}

// CRT scanlines: on by default at 3x scale and up, unless switched in the menu.
function crtOn() {
  const s = getSetting('crt', null);
  return s === null ? renderer.scale >= CONFIG.crt.autoScale : s;
}

const MENU = [
  { label: () => 'RESUME', run: () => resume() },
  { label: () => (isMuted() ? 'SOUND: OFF' : 'SOUND: ON'), run: () => toggleMute() },
  { label: () => (crtOn() ? 'CRT: ON' : 'CRT: OFF'), run: () => setSetting('crt', !crtOn()) },
  { label: () => 'REPLAY TUTORIAL', run: () => startRun(true) },
  { label: () => 'QUIT', run: () => toTitle() },
];

const internal = () => renderer.toInternal(input.pointer.x, input.pointer.y);

function handleMenuAction(a) {
  const itemAt = () => {
    const p = internal();
    return pauseMenuItemAt(p.x, p.y, renderer.width, MENU.length);
  };
  if (a === 'flipU' || a === 'flipD') {
    game.menuSel = (game.menuSel + (a === 'flipU' ? MENU.length - 1 : 1)) % MENU.length;
    playSfx('blip');
  } else if (a === 'press') {
    if (input.lastSource === 'pointer') {
      const i = itemAt();
      if (i < 0) return;
      if (i !== game.menuSel) playSfx('blip');
      game.menuSel = i;
    }
    game.armed = true;
  } else if (a === 'release' && game.armed) {
    game.armed = false;
    if (input.lastSource === 'pointer' && itemAt() !== game.menuSel) return;
    playSfx('select');
    MENU[game.menuSel].run();
  }
}

// --- Initials and game over ---------------------------------------------------------

// Swipe up / down changes the letter, a tap confirms it (swipes never count
// as taps), left steps back.
function handleInitials(a) {
  if (game.stateTime < CONFIG.menus.initialsLockout) return;
  const e = game.entry;
  if (a === 'flipU' || a === 'flipD') {
    e.letters[e.cursor] = (e.letters[e.cursor] + (a === 'flipU' ? 1 : 25)) % 26;
    playSfx('blip');
  } else if (a === 'flipL') {
    if (e.cursor > 0) {
      e.cursor--;
      playSfx('blip');
    }
  } else if (a === 'flipR') {
    confirmLetter();
  } else if (a === 'press') {
    game.armed = true;
  } else if (a === 'release' && game.armed) {
    game.armed = false;
    if (!input.releaseWasSwipe) confirmLetter();
  }
}

function confirmLetter() {
  const e = game.entry;
  playSfx('select');
  e.cursor++;
  if (e.cursor < 3) return;
  const name = e.letters.map((l) => String.fromCharCode(65 + l)).join('');
  setSetting('lastInitials', name);
  game.result.rank = addScore(name, e.score);
  refreshScores();
  setState('gameover');
}

function share() {
  const r = game.result;
  const text = `I scored ${r.score.toLocaleString('en-US')} in PIXEL GRIND`;
  const url = location.origin + location.pathname;
  const fallback = () => {
    const copy =
      navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(`${text} ${url}`)
        : Promise.reject(new Error('no clipboard'));
    copy.then(
      () => (r.msg = 'COPIED TO CLIPBOARD'),
      () => (r.msg = 'SHARING NOT AVAILABLE'),
    );
  };
  if (navigator.share) {
    navigator.share({ title: 'PIXEL GRIND', text, url }).catch((err) => {
      if (!err || err.name !== 'AbortError') fallback();
    });
  } else {
    fallback();
  }
}

function handleGameOver(a) {
  const buttonAt = () => {
    const p = internal();
    return gameOverButtonAt(p.x, p.y, renderer.width);
  };
  if (a === 'press') {
    if (game.stateTime < CONFIG.bail.retryDelay) return;
    game.armed = true;
    game.pressed = input.lastSource === 'pointer' ? buttonAt() : null;
  } else if (a === 'release' && game.armed) {
    game.armed = false;
    const pressed = game.pressed;
    game.pressed = null;
    if (!pressed) {
      startRun();
      return;
    }
    if (input.lastSource === 'pointer' && buttonAt() !== pressed) return;
    playSfx('select');
    if (pressed === 'share') share();
    else toTitle();
  }
}

function handleTitle(a) {
  if (a === 'press') {
    game.armed = true;
    const p = internal();
    game.pressed = input.lastSource === 'pointer' ? titleButtonAt(p.x, p.y, renderer.width, !!game.installPrompt) : null;
  } else if (a === 'release' && game.armed) {
    game.armed = false;
    if (game.pressed === 'install') {
      game.pressed = null;
      installApp();
      return;
    }
    startRun();
  }
}

function installApp() {
  const prompt = game.installPrompt;
  if (!prompt) return;
  game.installPrompt = null;
  refreshScores();
  prompt.prompt();
  prompt.userChoice.catch(() => {});
}

// --- Tutorial ----------------------------------------------------------------------
// Save a checkpoint as each one is passed; a bail rewinds to the last one
// instead of ending the run (no boards lost).

function updateTutorial(dt) {
  const tut = game.tutorial;
  const run = game.run;
  if (run.down) {
    tut.retry += dt;
    if (tut.retry >= CONFIG.tutorial.retryDelay) {
      setRun(cloneRun(tut.snap, CONFIG));
      addPopup('TRY AGAIN', COL.cream);
      startMusic();
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

// --- Debug tuning panel --------------------------------------------------------------
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

// --- Particles: dust, sparks, sparkle, debris --------------------------------------
// Visual only, so Math.random is fine here (gameplay randomness is seeded).

const DUST = [COL.steel, COL.cream, COL.slate];
const SPARKS = [COL.gold, COL.white, COL.orange];
const TOKEN_SPARKLE = [COL.gold, COL.cream, COL.white];
const DEBRIS = [COL.rose, COL.teal, COL.gold, COL.indigo];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const skaterCentreX = (run) => run.world.distance + CONFIG.world.skaterX + CONFIG.skater.spriteW / 2;

function burst(x, y, n, speed, life, colours, grav) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    parts.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.4), pick(colours), grav);
  }
}

// Puffs either side of the wheels on landing.
function dust(run) {
  const x = skaterCentreX(run);
  const y = run.player.y - 1;
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    parts.spawn(x + side * 5, y, side * (20 + Math.random() * 40), -10 - Math.random() * 20, 0.3 + Math.random() * 0.2, pick(DUST), 40);
  }
}

// Sparks off the trucks while grinding; they fly back as the world scrolls.
function grindSparks(run) {
  if (!run.player.grinding || run.ticks % 2) return;
  const x = run.world.distance + CONFIG.world.skaterX + (Math.random() < 0.5 ? 4 : 12);
  parts.spawn(x, run.player.y, -20 + Math.random() * 30, -30 - Math.random() * 50, 0.25 + Math.random() * 0.15, pick(SPARKS), 400);
}

// --- Run events: sounds, haptics, popups ------------------------------------------
// Trick names show in the combo chain (drawCombo); popups are for results.

function handleRunEvents(run) {
  const evs = run.events;
  if (game.state !== 'play') {
    evs.length = 0; // the demo run and finished runs stay quiet
    return;
  }
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    switch (e.type) {
      case 'launch':
        playSfx(e.kind === 'kicker' ? 'kicker' : 'ollie');
        break;
      case 'flipStart':
        playSfx('flip');
        break;
      case 'grind':
        playSfx('clank');
        grindLoop(true);
        break;
      case 'grindEnd':
        grindLoop(false);
        break;
      case 'token':
        playSfx('token');
        burst(e.x, e.y, 6, 50, 0.3, TOKEN_SPARKLE, 0);
        break;
      case 'land':
        playSfx(e.result === 'sketchy' ? 'sketchy' : 'land');
        dust(run);
        if (e.tricks > 0) {
          playSfx('combo', { points: e.points });
          if (e.result === 'sketchy') holdCombo(e.chain, 'SKETCHY! +' + e.points, COL.orange, renderer.width);
          else holdCombo(e.chain, '+' + e.points, COL.mint, renderer.width);
          if (e.points > CONFIG.haptics.bigComboPoints) vibrate(CONFIG.haptics.bigCombo);
          if (e.points > CONFIG.render.flashPoints) game.flash = 1;
        }
        break;
      case 'bail':
        playSfx('bail');
        vibrate(CONFIG.haptics.bail);
        stopMusic();
        grindLoop(false);
        burst(skaterCentreX(run), run.player.y - 10, 10, 90, 0.5, DEBRIS, 300);
        if (!run.over) addPopup('BAIL!', COL.rose);
        break;
      case 'respawn':
        startMusic();
        break;
      case 'extraBoard':
        playSfx('extraBoard');
        addPopup('EXTRA BOARD!', COL.mint);
        break;
    }
  }
  evs.length = 0;
}

// --- Input ---------------------------------------------------------------------

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
  if (a === 'mute') {
    toggleMute();
    return;
  }
  if (a === 'pause') {
    if (game.state === 'play' || game.state === 'countdown') pause();
    else if (game.state === 'paused' && !game.portrait) resume();
    else if (game.state === 'gameover') toTitle();
    return;
  }
  if (game.portrait) return;

  switch (game.state) {
    case 'play':
      if (a === 'press') runPress(game.run, CONFIG); // ollie on touch-down, same tick
      else if (a.startsWith('flip')) runFlip(game.run, a, CONFIG);
      break;
    case 'paused':
      handleMenuAction(a);
      break;
    case 'initials':
      handleInitials(a);
      break;
    case 'gameover':
      handleGameOver(a);
      break;
    case 'start':
      handleTitle(a);
      break;
    case 'boot':
      // Tap skips the boot text.
      if (a === 'press') game.armed = true;
      else if (a === 'release' && game.armed) toTitle();
      break;
    // 'countdown': input waits
  }
}

// --- Tick ------------------------------------------------------------------------

function tick(dt) {
  game.time += dt;
  game.stateTime += dt;
  const actions = input.drain();
  for (let i = 0; i < actions.length; i++) handleAction(actions[i]);
  if (game.portrait) return;

  switch (game.state) {
    case 'boot':
      if (game.stateTime >= CONFIG.boot.duration) toTitle();
      break;
    case 'start':
      updateDemo(dt);
      break;
    case 'countdown':
      updateCountdown();
      break;
    case 'initials':
    case 'gameover':
      stepRun(game.run, dt, CONFIG); // the last bail slides to a stop
      updatePopups(dt, CONFIG);
      updateCombo(dt, CONFIG);
      parts.update(dt);
      break;
    case 'play': {
      applyDebug(game.run);
      if (dbg.autopilot) {
        const a = bot.decide(game.run);
        if (a) handleAction(a);
      }
      stepRun(game.run, dt, CONFIG);
      setMusicTier(game.run.world.tier);
      updatePopups(dt, CONFIG);
      updateCombo(dt, CONFIG);
      grindSparks(game.run);
      parts.update(dt);
      if (game.tutorial) updateTutorial(dt);
      else if (game.run.over && game.run.downTime >= CONFIG.bail.gameOverDelay) gameOver();
      break;
    }
    // 'paused': frozen
  }
  if (game.run) handleRunEvents(game.run);
}

// --- Render ------------------------------------------------------------------------

function render() {
  const g = renderer.g;
  const W = renderer.width;
  const H = renderer.height;

  if (game.portrait) {
    drawRotateScreen(g, W, H, game.time, CONFIG);
  } else if (game.state === 'boot') {
    drawBootScreen(g, W, H, game.stateTime, CONFIG);
  } else {
    const run = game.run;
    drawWorld(g, W, run, sprites, CONFIG, parts);
    if (debug.enabled) drawHitboxes(g, W, run);
    if (game.state === 'start') {
      const panel = Math.floor(game.stateTime / CONFIG.attract.panelTime) % TITLE_PANELS;
      drawTitleScreen(g, W, H, game.stateTime, panel, game.titleData, CONFIG);
    } else {
      drawHud(g, W, run, game.best, sprites);
      drawCombo(g, W, run.tricks, CONFIG);
      if (game.tutorial && !run.down) {
        const lines = tutorialPrompt(run.world.distance, game.touch);
        if (lines) drawPrompt(g, W, lines);
      }
      drawPopups(g, W, CONFIG);
      switch (game.state) {
        case 'paused':
          drawPauseMenu(g, W, H, MENU.map((m) => m.label()), game.menuSel, sprites);
          break;
        case 'countdown':
          drawCountdown(g, W, String(Math.max(1, game.countdown)));
          break;
        case 'initials':
          drawInitialsScreen(g, W, H, game.stateTime, game.entry, game.touch, sprites);
          break;
        case 'gameover': {
          const canRetry = game.stateTime >= CONFIG.bail.retryDelay;
          drawGameOverScreen(g, W, H, game.stateTime, game.result, canRetry, game.touch, game.pressed, sprites, CONFIG);
          break;
        }
      }
    }
  }
  // One-frame white flash on big combos.
  if (game.flash > 0) {
    g.fillStyle = COL.white;
    g.fillRect(0, 0, W, H);
    game.flash--;
  }
  if (debug.enabled) debug.draw(g, W, debugLines);
  renderer.present();
  const crt = crtOn();
  if (crt !== game.crt) {
    game.crt = crt;
    crtEl.classList.toggle('on', crt);
  }
}

function segmentAhead(run) {
  const x = run.world.distance + CONFIG.world.skaterX;
  for (const ob of run.world.obstacles) if (ob.x + ob.w > x) return ob.seg || '-';
  return '-';
}

function debugLines(d) {
  const lines = [
    `FPS ${d.fps.toFixed(0)} FT ${d.ft.toFixed(1)} MAX ${d.ftMax.toFixed(1)}`,
    `CPU ${d.cpu.toFixed(2)} MAX ${d.cpuMax.toFixed(2)}`,
    `RES ${renderer.width}X${renderer.height} ${renderer.scale}X DPR ${renderer.dpr.toFixed(2)}`,
  ];
  const run = game.run;
  if (run) {
    const p = run.player;
    const flip = p.flip ? `${p.flip.toUpperCase()} ${p.flipTime.toFixed(2)}/${p.flipDur.toFixed(2)}` : '-';
    lines.push(
      `SPD ${run.world.speed.toFixed(0)} DIST ${run.world.distance.toFixed(0)}`,
      `FLIP ${flip} Q ${p.queued ? p.queued.toUpperCase() : '-'}`,
      `TIER ${run.world.tier} SEG ${segmentAhead(run).toUpperCase()}`,
      `BOARDS ${run.boards} TOKENS ${run.tokenPoints / CONFIG.tokens.points} INV ${run.invuln.toFixed(1)}`,
      `SEED ${run.seed}`,
    );
  }
  lines.push(`STATE ${game.state.toUpperCase()}${game.tutorial ? ' TUTORIAL' : ''}`, `BUILD ${BUILD}`);
  lines.push(`AUDIO ${audioState().toUpperCase()}${isMuted() ? ' MUTED' : ''}`);
  const flags = [dbg.autopilot && 'BOT', dbg.invincible && 'INVINCIBLE', dbg.slowmo && 'SLOW-MO'].filter(Boolean);
  if (flags.length) lines.push(flags.join(' '));
  const tuned = tuning.changedCount();
  if (tuned > 0) lines.push(`TUNED ${tuned} VALUES`);
  return lines;
}

// --- Loop ------------------------------------------------------------------------

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

// --- Platform hooks ------------------------------------------------------------------

input.uiHitTest = (clientX, clientY) => {
  if (game.state !== 'play' || game.portrait) return null;
  const p = renderer.toInternal(clientX, clientY);
  return hitPauseButton(p.x, p.y, renderer.width) ? 'pause' : null;
};

input.onGesture = () => {
  unlockAudio();
  if (game.touch && game.state !== 'play' && game.state !== 'boot') enterFullscreenLandscape();
};
window.addEventListener('touchend', unlockAudio, { passive: true });

// Auto-pause when the player leaves; resuming counts down 3-2-1.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    suspendAudio();
  } else {
    resumeAudio();
  }
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
    audio: { state: audioState, sounds: SOUNDS },
    step(n = 1) {
      checkPortrait();
      for (let i = 0; i < n; i++) tick(STEP);
      render();
    },
  };
}

// Start: boot text once per session, otherwise straight to the title.
refreshScores();
if (bootedThisSession()) toTitle();
else game.run = createRun(CONFIG, CONFIG.attract.seed, { spawn: false });

requestAnimationFrame(frame);
