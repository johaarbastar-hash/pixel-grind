// One run of the game: world + skater + collisions + score. No DOM access, so
// the same code drives the real game, the title-screen demo and headless tests.
// UI-facing happenings are pushed to run.events (drained by main.js):
//   { type: 'trick', trick }                        a flip landed in the air
//   { type: 'land', result, points, flips }         combo banked (clean / sketchy)

import { createRng } from './rng.js';
import { createWorld, updateWorld, stopWorld } from './world.js';
import { createPlayer, updatePlayer, pressOllie, pressFlip, bailPlayer, playerHitbox } from './player.js';
import { overlaps } from './collision.js';
import { createScore, startCombo, addTrick, bankCombo, loseCombo } from './score.js';
import { FLIP_FOR_ACTION } from './tricks.js';

export function createRun(cfg, seed, opts = {}) {
  return {
    seed,
    time: 0,
    score: 0,
    over: false,
    bailReason: null, // 'obstacle' | 'flip'
    world: createWorld(cfg, createRng(seed), opts),
    player: createPlayer(cfg),
    tricks: createScore(),
    hitbox: { x: 0, y: 0, w: 0, h: 0 },
    events: [],
  };
}

function bail(run, reason, cfg) {
  run.over = true;
  run.bailReason = reason;
  bailPlayer(run.player);
  stopWorld(run.world, cfg);
  loseCombo(run.tricks);
}

function handlePlayerEvents(run, cfg) {
  const evs = run.player.events;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (e.type === 'launch') {
      startCombo(run.tricks);
      addTrick(run.tricks, 'ollie', cfg);
    } else if (e.type === 'flipDone') {
      addTrick(run.tricks, e.trick, cfg);
      run.events.push({ type: 'trick', trick: e.trick });
    } else if (e.type === 'land') {
      if (e.result === 'bail') {
        bail(run, 'flip', cfg);
      } else {
        const flips = run.tricks.comboFlips;
        const fraction = e.result === 'sketchy' ? cfg.landing.sketchyBank : 1;
        const points = bankCombo(run.tricks, fraction);
        run.events.push({ type: 'land', result: e.result, points, flips });
      }
    }
  }
  evs.length = 0;
}

export function runPress(run, cfg) {
  if (run.over) return;
  pressOllie(run.player, cfg);
  handlePlayerEvents(run, cfg);
}

// action: 'flipL' | 'flipR' | 'flipU' | 'flipD'
export function runFlip(run, action, cfg) {
  if (run.over) return;
  pressFlip(run.player, FLIP_FOR_ACTION[action], cfg);
  handlePlayerEvents(run, cfg);
}

export function stepRun(run, dt, cfg) {
  run.time += dt;
  updatePlayer(run.player, dt, cfg);
  if (!run.over) handlePlayerEvents(run, cfg);
  else run.player.events.length = 0;
  updateWorld(run.world, dt, cfg);
  if (run.over) return;

  const hb = playerHitbox(run.player, run.world.distance, cfg, run.hitbox);
  const list = run.world.obstacles;
  for (let i = 0; i < list.length; i++) {
    const ob = list[i];
    if (ob.x > hb.x + hb.w) break; // sorted by x: nothing further can touch
    if (overlaps(hb, ob.hit)) {
      bail(run, 'obstacle', cfg);
      return;
    }
  }
  run.score = Math.floor(run.world.distance / cfg.score.pxPerPoint) + run.tricks.banked;
}
