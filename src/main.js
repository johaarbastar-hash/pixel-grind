// Fixed-timestep loop and the state machine.
// States: boot -> start (title + demo run) -> play <-> paused -> countdown ->
// play ... -> [continue: buy a board back] -> initials (top 10 only) ->
// gameover -> play / start. The shop opens from the title or the game-over
// screen and goes back to it.
// Portrait on a phone overrides everything with the rotate screen.

import { CONFIG } from './config.js';
import { randomSeed } from './rng.js';
import { createInput } from './input.js';
import { createRenderer, drawWorld, createParticles } from './render.js';
import { buildSprites, buildSkater, buildSkaterTile, COL } from './sprites.js';
import { createRun, cloneRun, runPress, runFlip, stepRun, reviveRun } from './run.js';
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
  drawBanner,
  hypeTier,
  fmt,
  drawShopScreen,
  shopHitAt,
  drawContinueScreen,
  continueButtonAt,
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
import { createShop } from './shop.js';
import { SLOTS, SLOT_NAMES, itemsIn, lookFor } from './gear.js';
import {
  parseChallenge,
  challengeQuery,
  CHALLENGE_PARAMS,
  dateKey,
  dailySeed,
  getDaily,
  recordDailyAttempt,
  recordDailyScore,
  getStreak,
  finishRunForStreak,
} from './modes.js';

/* global __BUILD_ID__ */
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'DEV';
const STEP = 1 / CONFIG.loop.hz;
const REFRESH_INTERVALS = [1 / 30, 1 / 60, 1 / 90, 1 / 120, 1 / 144];

// URL options: ?debug=1 overlay, ?seed=N fixed seed, ?tutorial=1 force the
// tutorial, ?bot=1 autopilot. Soak-test replays: ?tier=T&speed=V&seg=ID
// (fixed tier / speed, repeat one segment, skip the opening).
const params = new URLSearchParams(location.search);
const intParam = (name) => (params.has(name) ? Number.parseInt(params.get(name), 10) || 0 : 0);
// A challenge link (seed + beat) is handled by game.challenge instead.
const challengeLink = parseChallenge(params, CONFIG);
let urlSeed = params.has('seed') && !challengeLink ? Number.parseInt(params.get('seed'), 10) >>> 0 : null;
const urlSpeed = intParam('speed');
const urlSeg = params.get('seg');
const replay = !!(params.has('tier') || urlSpeed || urlSeg);

const crtEl = document.getElementById('crt');
const renderer = createRenderer(CONFIG, document.getElementById('screen'), document.getElementById('stage'), crtEl);
const parts = createParticles(CONFIG.render.particles);
const shop = createShop(CONFIG);
const sprites = buildSprites(CONFIG, shop.gear);
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
  shop: null, // shop screen: { from, tab, sel, items, preview, view, msg }
  installPrompt: null, // Android install prompt, when the browser offers one (M8)
  flash: 0, // frames of white flash left (big combos)
  newBest: false, // this run has passed the #1 score (game.best)
  bannerTime: 0, // s the NEW BEST! banner has left
  hitStop: 0, // ticks the world stays frozen after a hype-tier combo
  challenge: challengeLink, // { seed, beat, by } while in challenge mode
  beaten: false, // this run has passed the challenge score
  beatenTime: 0, // s BEATEN! stays on the HUD
  daily: null, // date key while playing daily runs from the DAILY button
  runDaily: null, // date key of the current run's daily course, or null
  runCountsToday: false, // the current run counts for today's daily record
  continues: 0, // continues bought this run
  zoomTime: 0, // s of zoom punch left
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
    wallet: shop.wallet,
    challenge: game.challenge,
    daily: getDaily(dateKey()),
    streak: getStreak(dateKey()),
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
  game.hitStop = 0;
  game.zoomTime = 0;
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

// Today's course, same for everyone. Retries stay on it until TITLE.
function startDaily() {
  leaveChallenge();
  game.daily = dateKey();
  startRun();
}

function toTitle() {
  game.daily = null;
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

// Challenge and daily runs never have the tutorial: it would change the course.
function startRun(forceTutorial = false) {
  const c = game.challenge;
  game.runDaily = (c && c.daily) || game.daily;
  game.runCountsToday = game.runDaily === dateKey();
  if (game.runCountsToday) recordDailyAttempt(game.runDaily);
  const tutorial =
    !c &&
    !game.runDaily &&
    (forceTutorial || params.get('tutorial') === '1' || (!replay && !getSetting('tutorialDone', false)));
  let seed;
  if (c) seed = c.seed;
  else if (game.runDaily) seed = dailySeed(game.runDaily);
  else seed = urlSeed ?? randomSeed();
  const run = createRun(CONFIG, seed, { spawn: true, script: tutorial ? TUTORIAL : null });
  if (replay) run.world.nextSpawnX = CONFIG.view.maxWidth + 40; // straight to the action, like the soak test
  if (urlSpeed) run.world.speedOverride = urlSpeed;
  setRun(run);
  game.tutorial = tutorial ? { snap: cloneRun(run, CONFIG), cp: 0, retry: 0 } : null;
  game.newBest = false;
  game.bannerTime = 0;
  game.beaten = false;
  game.beatenTime = 0;
  game.continues = 0;
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
  // The first finished run of the day extends the streak and pays a bonus.
  const streak = finishRunForStreak(dateKey(), CONFIG);
  shop.addCoins(streak.bonus);
  shop.save();
  recordRun({ distance: run.world.distance, bestCombo: run.tricks.best, tricks: run.tricks.landed, coins: run.coins });
  const rank = scoreRank(run.score);
  game.result = {
    score: run.score,
    bestCombo: run.tricks.best,
    distance: run.world.distance,
    coins: run.coins,
    wallet: shop.wallet,
    streakBonus: streak.bonus,
    bonusPlayed: false, // the bonus jingle, once the game-over screen is up
    best: game.best,
    challenge: game.challenge,
    dailyBest: game.runCountsToday && recordDailyScore(game.runDaily, run.score),
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

// --- NEW BEST --------------------------------------------------------------------
// Passing the #1 score in the table (the made-up PXG 5000 counts until it's
// beaten): a banner, a short sting (once per run), and the HUD hi-score turns
// gold and follows the live score.

function checkNewBest(dt) {
  if (game.bannerTime > 0) game.bannerTime = Math.max(0, game.bannerTime - dt);
  if (game.newBest || game.run.score <= game.best) return;
  game.newBest = true;
  game.bannerTime = CONFIG.best.bannerTime;
  playSfx('best');
}

// --- Challenge mode ----------------------------------------------------------------
// From a link (?seed=S&beat=N&by=XYZ): every run uses that seed, the HUD
// shows the score to beat, and game-over says who won. Leaving (TITLE on the
// game-over screen) drops the link's params from the address bar.

function leaveChallenge() {
  if (!game.challenge) return;
  game.challenge = null;
  urlSeed = null;
  try {
    const url = new URL(location.href);
    for (const k of CHALLENGE_PARAMS) url.searchParams.delete(k);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    // no history API: the params stay in the address bar, that's all
  }
}

function checkChallenge(dt) {
  if (game.beatenTime > 0) game.beatenTime = Math.max(0, game.beatenTime - dt);
  const c = game.challenge;
  if (!c || game.beaten || game.run.score <= c.beat) return;
  game.beaten = true;
  game.beatenTime = CONFIG.challenge.beatenTime;
}

// HUD line under the hi-score: the score to beat, BEATEN!, then the margin.
// A daily run with nothing to beat just says so.
const DAILY_LINE = { text: 'DAILY RUN', color: COL.teal };
let beatLine = { text: '', color: COL.cream, key: '' };
function hudBeat() {
  const c = game.challenge;
  if (!c) return game.runDaily ? DAILY_LINE : null;
  let text;
  let color;
  if (!game.beaten) {
    text = 'BEAT ' + fmt(c.beat);
    color = COL.cream;
  } else if (game.beatenTime > 0) {
    text = 'BEATEN!';
    color = COL.gold;
  } else {
    text = '+' + fmt(game.run.score - c.beat);
    color = COL.mint;
  }
  if (beatLine.key !== text) beatLine = { text, color, key: text };
  return beatLine;
}

// --- Continue for coins ---------------------------------------------------------------
// After the last bail, a few seconds to buy 1 board back (CONFIG.continue).
// Only the CONTINUE button (or C) does anything; otherwise the time runs out
// into game over. Not in challenge or daily runs, so shared scores compare.

const continuePrice = () => CONFIG.continue.price * CONFIG.continue.priceGrowth ** game.continues;

function endOfRun() {
  const offer = !game.challenge && !game.runDaily && !game.tutorial && game.continues < CONFIG.continue.max;
  if (offer) setState('continue');
  else gameOver();
}

function buyContinue() {
  if (!shop.spend(continuePrice())) {
    playSfx('blip');
    return;
  }
  game.continues++;
  playSfx('buy');
  reviveRun(game.run, CONFIG);
  setState('play'); // the respawn event restarts the music
}

function handleContinue(a) {
  const onButton = () => {
    const p = internal();
    return continueButtonAt(p.x, p.y, renderer.width);
  };
  if (a === 'continue') {
    buyContinue();
  } else if (a === 'press' && input.lastSource === 'pointer') {
    game.armed = onButton();
    game.pressed = game.armed ? 'continue' : null;
  } else if (a === 'release' && game.armed) {
    game.armed = false;
    game.pressed = null;
    if (onButton() && !input.releaseWasSwipe) buyContinue();
  }
}

// --- Pause, countdown ----------------------------------------------------------------
// Music and the grind loop stop on pause, bail and game over. Pausing also
// saves the wallet (coins are added in memory as they are picked up), so
// leaving the app or quitting a run keeps them.

function pause() {
  if (game.state !== 'play' && game.state !== 'countdown') return;
  shop.save();
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
  {
    label: () => 'REPLAY TUTORIAL',
    run: () => {
      leaveChallenge();
      game.daily = null;
      startRun(true);
    },
  },
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

// Shares a challenge link: the same course (seed) with this score to beat.
function share() {
  const r = game.result;
  const text = `I scored ${fmt(r.score)} in PIXEL GRIND. Beat me:`;
  const by = getSetting('lastInitials', null) || 'YOU';
  const url = location.origin + location.pathname + challengeQuery(game.run.seed, game.runDaily, r.score, by);
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
    else if (pressed === 'shop') openShop();
    else {
      leaveChallenge();
      toTitle();
    }
  }
}

function handleTitle(a) {
  if (a === 'press') {
    game.armed = true;
    const p = internal();
    game.pressed = input.lastSource === 'pointer' ? titleButtonAt(p.x, p.y, renderer.width, !!game.installPrompt) : null;
  } else if (a === 'release' && game.armed) {
    game.armed = false;
    const pressed = game.pressed;
    game.pressed = null;
    if (pressed && input.lastSource === 'pointer') {
      const p = internal();
      if (titleButtonAt(p.x, p.y, renderer.width, !!game.installPrompt) !== pressed) return;
    }
    if (pressed === 'install') installApp();
    else if (pressed === 'shop') {
      playSfx('select');
      openShop();
    } else if (pressed === 'daily') startDaily();
    else startRun();
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

// --- Shop ------------------------------------------------------------------------
// Tabs for the gear slots, a tile per item. Tap a tile to try it on in the
// preview, then BUY (which also puts it on) or EQUIP. Swipes / arrow keys:
// left-right picks an item, up-down a tab.

function openShop() {
  game.shop = { from: game.state, tab: 0, sel: 0, items: null, preview: null, view: null, msg: null };
  setState('shop');
  selectShopTab(0);
}

function closeShop() {
  const from = game.shop.from;
  game.shop = null;
  if (from === 'gameover') {
    game.result.wallet = shop.wallet;
    setState('gameover');
  } else {
    refreshScores();
    setState('start');
  }
}

// The skater in the worn gear with one item swapped in.
const tryOn = (it) => lookFor({ ...shop.gear, [it.slot]: it.id });

function selectShopTab(tab) {
  const s = game.shop;
  s.tab = (tab + SLOTS.length) % SLOTS.length;
  const slot = SLOTS[s.tab];
  s.items = itemsIn(slot).map((it) => ({ it, tile: buildSkaterTile(tryOn(it), slot === 'board') }));
  selectShopItem(Math.max(0, s.items.findIndex((e) => shop.wearing(e.it.id))));
}

function selectShopItem(i) {
  const s = game.shop;
  s.sel = (i + s.items.length) % s.items.length;
  s.preview = buildSkater(tryOn(s.items[s.sel].it));
  s.msg = null;
  updateShopView();
}

// What the shop screen draws (see drawShopScreen), rebuilt on every change.
function updateShopView() {
  const s = game.shop;
  const it = s.items[s.sel].it;
  const price = shop.price(it);
  let action;
  if (shop.wearing(it.id)) action = { label: 'EQUIPPED', disabled: true };
  else if (shop.owns(it.id)) action = { label: 'EQUIP', disabled: false };
  else action = { label: 'BUY ¤' + price, disabled: shop.wallet < price };
  s.view = {
    tabs: SLOTS.map((slot) => SLOT_NAMES[slot]),
    tab: s.tab,
    items: s.items.map((e) => ({
      name: e.it.name,
      price: shop.price(e.it),
      owned: shop.owns(e.it.id),
      worn: shop.wearing(e.it.id),
      tile: e.tile,
    })),
    sel: s.sel,
    wallet: shop.wallet,
    preview: s.preview,
    action,
    msg: null,
    pressed: null,
  };
}

function shopMessage(text, color) {
  game.shop.msg = { text, color, at: game.stateTime };
}

function shopAction() {
  const s = game.shop;
  const it = s.items[s.sel].it;
  if (shop.wearing(it.id)) return;
  let msg = null;
  if (shop.owns(it.id)) {
    shop.wear(it.id);
    playSfx('select');
  } else if (shop.buy(it.id)) {
    playSfx('buy');
    msg = 'BOUGHT ' + it.name + '!';
  } else {
    playSfx('blip');
    shopMessage('NOT ENOUGH COINS', COL.rose);
    return;
  }
  sprites.skater = buildSkater(lookFor(shop.gear));
  selectShopTab(s.tab); // tiles show the other slots as worn
  if (msg) shopMessage(msg, COL.mint);
}

function handleShop(a) {
  const s = game.shop;
  const hit = () => {
    const p = internal();
    return shopHitAt(p.x, p.y, renderer.width, SLOTS.length, s.items.length);
  };
  if (a === 'flipL' || a === 'flipR') {
    selectShopItem(s.sel + (a === 'flipR' ? 1 : -1));
    playSfx('blip');
  } else if (a === 'flipU' || a === 'flipD') {
    selectShopTab(s.tab + (a === 'flipD' ? 1 : -1));
    playSfx('blip');
  } else if (a === 'press') {
    game.armed = true;
    game.pressed = input.lastSource === 'pointer' ? hit() : 'action';
  } else if (a === 'release' && game.armed) {
    game.armed = false;
    const pressed = game.pressed;
    game.pressed = null;
    if (!pressed) return;
    if (input.lastSource === 'pointer' && (input.releaseWasSwipe || hit() !== pressed)) return;
    if (pressed === 'back') {
      playSfx('select');
      closeShop();
    } else if (pressed === 'action') {
      shopAction();
    } else if (pressed.startsWith('tab:')) {
      const tab = Number(pressed.slice(4));
      if (tab !== s.tab) {
        selectShopTab(tab);
        playSfx('blip');
      }
    } else {
      const i = Number(pressed.slice(5));
      if (i !== s.sel) {
        selectShopItem(i);
        playSfx('blip');
      }
    }
  }
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
const COIN_SPARKLE = [COL.gold, COL.cream, COL.white];
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
      case 'coin':
        shop.addCoins(1);
        playSfx('coin');
        burst(e.x, e.y, 6, 50, 0.3, COIN_SPARKLE, 0);
        break;
      case 'land':
        playSfx(e.result === 'sketchy' ? 'sketchy' : 'land');
        dust(run);
        if (e.tricks > 0) {
          const tier = hypeTier(e.points, CONFIG);
          if (e.result === 'sketchy') holdCombo(e.chain, 'SKETCHY! +' + e.points, COL.orange, renderer.width, tier);
          else holdCombo(e.chain, '+' + e.points, COL.mint, renderer.width, tier);
          if (tier >= 0) hype(tier);
          else playSfx('combo', { points: e.points });
          if (tier >= CONFIG.haptics.gnarlyFrom) vibrate(CONFIG.haptics.gnarly);
          else if (e.points > CONFIG.haptics.bigComboPoints) vibrate(CONFIG.haptics.bigCombo);
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
    }
  }
  evs.length = 0;
}

// Combo hype (CONFIG.hype): the tier's arpeggio (instead of the plain combo
// sound), a hit-stop, and a zoom punch from SICK up.
function hype(tier) {
  playSfx('hype', { tier });
  game.hitStop = CONFIG.hype.tiers[tier].hitStop;
  if (tier >= CONFIG.hype.zoomFrom) game.zoomTime = CONFIG.hype.zoomTime;
}

// Zoom punch: 1 -> 1 + zoom -> 1 over zoomTime.
function zoomScale() {
  if (game.zoomTime <= 0) return 1;
  const h = CONFIG.hype;
  return 1 + h.zoom * Math.sin(Math.PI * (1 - game.zoomTime / h.zoomTime));
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
  // Keys for the SHOP and DAILY buttons.
  if (a === 'shop' || a === 'daily') {
    if (game.portrait) return;
    if (a === 'daily' && game.state === 'start') startDaily();
    const canShop = game.state === 'start' || (game.state === 'gameover' && game.stateTime >= CONFIG.bail.retryDelay);
    if (a === 'shop' && canShop) {
      playSfx('select');
      openShop();
    }
    return;
  }
  if (a === 'pause') {
    if (game.state === 'play' || game.state === 'countdown') pause();
    else if (game.state === 'paused' && !game.portrait) resume();
    else if (game.state === 'gameover') {
      leaveChallenge();
      toTitle();
    }
    else if (game.state === 'shop') closeShop();
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
    case 'shop':
      handleShop(a);
      break;
    case 'continue':
      handleContinue(a);
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
    case 'shop':
      if (game.shop.from === 'start') updateDemo(dt); // the demo plays on behind
      break;
    case 'countdown':
      updateCountdown();
      break;
    case 'continue':
      stepRun(game.run, dt, CONFIG);
      updatePopups(dt, CONFIG);
      updateCombo(dt, CONFIG, game.run.tricks);
      parts.update(dt);
      if (game.stateTime >= CONFIG.continue.time) gameOver();
      break;
    case 'initials':
    case 'gameover':
      stepRun(game.run, dt, CONFIG); // the last bail slides to a stop
      updatePopups(dt, CONFIG);
      updateCombo(dt, CONFIG, game.run.tricks);
      parts.update(dt);
      if (game.state === 'gameover') {
        const r = game.result;
        if (r.streakBonus > 0 && !r.bonusPlayed && game.stateTime >= CONFIG.streak.jingleDelay) {
          r.bonusPlayed = true;
          playSfx('buy');
        }
      }
      break;
    case 'play': {
      if (game.zoomTime > 0) game.zoomTime = Math.max(0, game.zoomTime - dt);
      // Hit-stop: the world holds still for a few frames. Input still lands
      // (handleAction runs above), so a tap during it isn't lost.
      if (game.hitStop > 0) {
        game.hitStop--;
        break;
      }
      applyDebug(game.run);
      if (dbg.autopilot) {
        const a = bot.decide(game.run);
        if (a) handleAction(a);
      }
      stepRun(game.run, dt, CONFIG);
      setMusicTier(game.run.world.tier);
      updatePopups(dt, CONFIG);
      updateCombo(dt, CONFIG, game.run.tricks);
      grindSparks(game.run);
      parts.update(dt);
      checkNewBest(dt);
      checkChallenge(dt);
      if (game.tutorial) updateTutorial(dt);
      else if (game.run.over && game.run.downTime >= CONFIG.bail.gameOverDelay) endOfRun();
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
      drawTitleScreen(g, W, H, game.stateTime, panel, game.titleData, game.pressed, CONFIG);
    } else if (game.state === 'shop') {
      const s = game.shop;
      s.view.pressed = game.pressed;
      s.view.msg = s.msg && game.stateTime - s.msg.at < CONFIG.shop.msgTime ? s.msg : null;
      drawShopScreen(g, W, H, game.stateTime, s.view, sprites, CONFIG);
    } else {
      // The end-of-run screens have the numbers themselves.
      if (game.state !== 'initials' && game.state !== 'gameover') {
        drawHud(g, W, run, game.best, sprites, game.newBest, hudBeat());
        drawCombo(g, W, run.tricks, CONFIG);
        if (game.tutorial && !run.down) {
          const lines = tutorialPrompt(run.world.distance, game.touch);
          if (lines) drawPrompt(g, W, lines);
        }
        drawPopups(g, W, CONFIG);
        if (game.bannerTime > 0) drawBanner(g, W, 'NEW BEST!', COL.gold);
      }
      switch (game.state) {
        case 'paused':
          drawPauseMenu(g, W, H, MENU.map((m) => m.label()), game.menuSel, sprites);
          break;
        case 'countdown':
          drawCountdown(g, W, String(Math.max(1, game.countdown)));
          break;
        case 'continue': {
          const left = 1 - game.stateTime / CONFIG.continue.time;
          drawContinueScreen(g, W, H, continuePrice(), shop.wallet, left, game.pressed === 'continue', game.touch, sprites);
          break;
        }
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
  renderer.present(game.state === 'play' ? zoomScale() : 1);
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
      `BOARDS ${run.boards} COINS ${run.coins} WALLET ${shop.wallet} INV ${run.invuln.toFixed(1)}`,
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
    shop,
    sprites,
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

// Offline play: the service worker is generated at build time (vite.config.js),
// so it only exists in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // No offline mode (e.g. private browsing): the game still works online.
    });
  });
}

// Android: Chrome offers installing the app; keep the prompt for the title
// screen's INSTALL button instead of the browser's own banner.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  game.installPrompt = e;
  refreshScores();
});
window.addEventListener('appinstalled', () => {
  game.installPrompt = null;
  refreshScores();
});

// Start: boot text once per session, otherwise straight to the title.
refreshScores();
if (bootedThisSession()) toTitle();
else game.run = createRun(CONFIG, CONFIG.attract.seed, { spawn: false });

requestAnimationFrame(frame);
