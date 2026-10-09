// Scrolling and obstacle spawning. Obstacles are placed by world distance, never
// by screen width, so every phone gets the same run for the same seed; wider
// screens just see further ahead.
// M1 spawner: single cones and pairs at fair random gaps. M3 replaces it with
// hand-authored segments and adds the speed curve.

import { makeObstacle } from './collision.js';

export function createWorld(cfg, rng, { spawn = true } = {}) {
  return {
    rng,
    spawn,
    distance: 0, // px scrolled; the camera's left edge in world space
    speed: cfg.world.startSpeed,
    decel: 0,
    obstacles: [], // sorted by x
    // First obstacle enters the widest screen once openingClear seconds have passed.
    nextSpawnX: cfg.world.startSpeed * cfg.spawn.openingClear + cfg.view.maxWidth,
  };
}

export function stopWorld(w, cfg) {
  w.decel = w.speed / cfg.bail.slideTime;
}

export function updateWorld(w, dt, cfg) {
  // Constant speed until the M3 speed curve; read live so the tuning panel applies.
  if (w.decel > 0) w.speed = Math.max(0, w.speed - w.decel * dt);
  else w.speed = cfg.world.startSpeed;
  w.distance += w.speed * dt;
  if (w.spawn) spawnAhead(w, cfg);
  cull(w, cfg);
}

function spawnAhead(w, cfg) {
  const sp = cfg.spawn;
  const horizon = w.distance + cfg.view.maxWidth + sp.lookahead;
  const speed = Math.max(w.speed, cfg.world.startSpeed);
  while (w.nextSpawnX < horizon) {
    const x = Math.round(w.nextSpawnX);
    w.obstacles.push(makeObstacle('lowBlock', x, cfg));
    let end = x + cfg.obstacles.lowBlock.w;
    if (w.rng.chance(sp.pairChance)) {
      const x2 = end + sp.pairGap;
      w.obstacles.push(makeObstacle('lowBlock', x2, cfg));
      end = x2 + cfg.obstacles.lowBlock.w;
    }
    const gapTime = cfg.physics.ollieAirtime + sp.gapPadding + w.rng.range(0, sp.randomExtra);
    w.nextSpawnX = end + gapTime * speed;
  }
}

function cull(w, cfg) {
  const list = w.obstacles;
  const limit = w.distance - cfg.world.cullMargin;
  let n = 0;
  while (n < list.length && list[n].x + list[n].w < limit) n++;
  if (n > 0) list.splice(0, n);
}
