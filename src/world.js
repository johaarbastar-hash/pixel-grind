// Scrolling, speed curve, tiers and segment spawning. Obstacles are placed by
// world distance, never by screen width, so every phone gets the same run for
// the same seed; wider screens just see further ahead.

import { makeObstacle } from './collision.js';
import { SEGMENT_BY_ID, pickSegment } from './segments.js';
import { cloneRng } from './rng.js';

// Eased (smoothstep) from start to max speed over speedRampTime of run time.
export function speedAt(clock, cfg) {
  const w = cfg.world;
  const t = Math.min(1, Math.max(0, clock / w.speedRampTime));
  return w.startSpeed + (w.maxSpeed - w.startSpeed) * t * t * (3 - 2 * t);
}

export function tierAt(clock, cfg) {
  let tier = 1;
  for (const at of cfg.tiers.unlockAt) if (clock >= at) tier++;
  return tier;
}

// script: optional fixed opening ({ length, items: [{ type, x, w }] }), e.g. the
// tutorial. The difficulty clock stays at 0 until the script has been ridden.
export function createWorld(cfg, rng, { spawn = true, script = null } = {}) {
  return {
    rng,
    spawn,
    script,
    scriptIndex: 0,
    distance: 0, // px scrolled; the camera's left edge in world space
    clock: 0, // s of run time driving speed and tiers
    speed: cfg.world.startSpeed,
    tier: 1,
    decel: 0,
    obstacles: [], // sorted by x
    nextSpawnX: script ? script.length : cfg.world.startSpeed * cfg.spawn.openingClear + cfg.view.maxWidth,
    lastSeg: null,
    // Debug / soak overrides
    tierOverride: 0,
    speedOverride: 0,
    forceNext: null, // segment id to spawn next
  };
}

export function cloneWorld(w) {
  return { ...w, rng: cloneRng(w.rng), obstacles: w.obstacles.slice() };
}

export function inScript(w) {
  return !!w.script && w.distance < w.script.length;
}

export function stopWorld(w, cfg) {
  w.decel = w.speed / cfg.bail.slideTime;
}

export function updateWorld(w, dt, cfg) {
  if (!inScript(w)) w.clock += dt;
  w.tier = w.tierOverride || tierAt(w.clock, cfg);
  if (w.decel > 0) w.speed = Math.max(0, w.speed - w.decel * dt);
  else w.speed = w.speedOverride || speedAt(w.clock, cfg);
  w.distance += w.speed * dt;
  if (w.spawn) spawnAhead(w, cfg);
  cull(w, cfg);
}

function insert(list, ob) {
  let i = list.length;
  while (i > 0 && list[i - 1].x > ob.x) i--;
  list.splice(i, 0, ob);
}

function spawnAhead(w, cfg) {
  const horizon = w.distance + cfg.view.maxWidth + cfg.spawn.lookahead;
  if (w.script) {
    const items = w.script.items;
    while (w.scriptIndex < items.length && items[w.scriptIndex].x < horizon) {
      const it = items[w.scriptIndex++];
      insert(w.obstacles, makeObstacle(it.type, it.x, cfg, it.w, 'tutorial'));
    }
  }
  while (w.nextSpawnX < horizon) spawnSegment(w, cfg);
}

function spawnSegment(w, cfg) {
  const forced = w.forceNext && SEGMENT_BY_ID[w.forceNext];
  w.forceNext = null;
  const seg = forced || pickSegment(w.rng, w.tier, w.lastSeg, cfg);
  w.lastSeg = seg.id;

  const start = cfg.world.startSpeed;
  const speed = Math.max(w.speed, start);
  const stretch = speed / start;
  const x0 = Math.round(w.nextSpawnX);
  let end = x0;
  for (const it of seg.items) {
    const x = x0 + Math.round(it.x * stretch);
    const width = it.type === 'gap' ? Math.round(it.w * stretch) : it.w;
    const ob = makeObstacle(it.type, x, cfg, width, seg.id);
    insert(w.obstacles, ob);
    const tail = (cfg.spawn.tail[it.type] || 0) * speed;
    end = Math.max(end, x + ob.w + tail);
  }
  const space = cfg.physics.ollieAirtime + cfg.spawn.gapPadding + w.rng.range(0, cfg.spawn.randomExtra);
  w.nextSpawnX = end + space * speed;
}

function cull(w, cfg) {
  const list = w.obstacles;
  const limit = w.distance - cfg.world.cullMargin;
  let n = 0;
  while (n < list.length && list[n].x + list[n].w < limit) n++;
  if (n > 0) list.splice(0, n);
}
