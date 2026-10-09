// One run of the game: world + skater + collisions + score. No DOM access, so
// the same code drives the real game, the title-screen demo and headless tests.

import { createRng } from './rng.js';
import { createWorld, updateWorld, stopWorld } from './world.js';
import { createPlayer, updatePlayer, pressOllie, bailPlayer, playerHitbox } from './player.js';
import { overlaps } from './collision.js';

export function createRun(cfg, seed, opts = {}) {
  return {
    seed,
    time: 0,
    score: 0,
    over: false,
    world: createWorld(cfg, createRng(seed), opts),
    player: createPlayer(cfg),
    hitbox: { x: 0, y: 0, w: 0, h: 0 },
  };
}

export function runPress(run, cfg) {
  if (!run.over) pressOllie(run.player, cfg);
}

export function stepRun(run, dt, cfg) {
  run.time += dt;
  updatePlayer(run.player, dt, cfg);
  updateWorld(run.world, dt, cfg);
  if (run.over) return;

  const hb = playerHitbox(run.player, run.world.distance, cfg, run.hitbox);
  const list = run.world.obstacles;
  for (let i = 0; i < list.length; i++) {
    const ob = list[i];
    if (ob.x > hb.x + hb.w) break; // sorted by x: nothing further can touch
    if (overlaps(hb, ob.hit)) {
      run.over = true;
      bailPlayer(run.player);
      stopWorld(run.world, cfg);
      return;
    }
  }
  run.score = Math.floor(run.world.distance / cfg.score.pxPerPoint);
}
