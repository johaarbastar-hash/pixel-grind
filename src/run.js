// One run of the game: world + skater + collisions + score + boards. No DOM
// access, so the same code drives the real game, the title-screen demo, the
// bot's lookahead and headless soak tests.
//
// Bails: the skater goes down (run.down), loses a board, and respawns after
// CONFIG.bail.respawnDelay with the road ahead cleared and a moment of
// invulnerability. With no boards left the run is over (run.over). There are
// no extra boards: every run gets CONFIG.lives.start.
//
// UI-facing happenings are pushed to run.events (drained by main.js):
//   { type: 'launch', kind }                   ollie / pop ('ollie') or kicker
//   { type: 'flipStart', trick }               a flip started spinning
//   { type: 'trick', trick }                   a flip landed in the air
//   { type: 'grind' } { type: 'grindEnd' }     started / stopped grinding
//   { type: 'land', result, points, tricks, chain }   combo banked on the ground
//   { type: 'bail', reason }                   went down
//   { type: 'respawn' }
//   { type: 'coin', x, y }                     picked up a coin (main.js adds it to the wallet)

import { createRng } from './rng.js';
import { createWorld, cloneWorld, updateWorld, stopWorld } from './world.js';
import {
  createPlayer,
  clonePlayer,
  updatePlayer,
  pressOllie,
  pressFlip,
  bailPlayer,
  playerHitbox,
} from './player.js';
import { overlaps } from './collision.js';
import { createScore, cloneScore, startCombo, addTrick, addGrindTick, bankCombo, loseCombo } from './score.js';
import { FLIP_FOR_ACTION } from './tricks.js';

export function createRun(cfg, seed, opts = {}) {
  const run = {
    seed,
    ticks: 0,
    time: 0,
    score: 0,
    coins: 0, // picked up this run
    boards: cfg.lives.start,
    down: false, // bailed, waiting to respawn
    downTime: 0,
    over: false, // no boards left
    crashes: 0,
    invincible: false, // debug toggle
    invuln: 0, // s of invulnerability left after a respawn
    freeze: 0, // s of freeze frame left
    shake: 0, // s of screen shake left
    bailReason: null, // 'flip' | 'gap' | obstacle type
    bailSeg: null, // segment id of what caused the bail
    world: createWorld(cfg, createRng(seed), opts),
    player: createPlayer(cfg),
    tricks: createScore(),
    hitbox: { x: 0, y: 0, w: 0, h: 0 },
    events: [],
    env: null,
  };
  run.env = makeEnv(run, cfg);
  return run;
}

export function cloneRun(run, cfg) {
  const c = {
    ...run,
    world: cloneWorld(run.world),
    player: clonePlayer(run.player),
    tricks: cloneScore(run.tricks),
    hitbox: { ...run.hitbox },
    events: [],
  };
  c.env = makeEnv(c, cfg);
  return c;
}

// Board contact points in world x: the wheels and the centre.
function boardSpan(run, cfg) {
  const left = run.world.distance + cfg.world.skaterX + (cfg.skater.spriteW - cfg.skater.hitboxW) / 2;
  return { left, right: left + cfg.skater.hitboxW, centre: left + cfg.skater.hitboxW / 2 };
}

// The world as the skater sees it (see player.js).
function makeEnv(run, cfg) {
  return {
    floor() {
      const b = boardSpan(run, cfg);
      const groundY = cfg.world.groundY;
      const safe = run.invincible || run.invuln > 0;
      for (const ob of run.world.obstacles) {
        if (ob.x > b.right) break;
        // Over a gap only when both wheels are over the hole.
        if (ob.type === 'gap' && !safe && ob.x <= b.left && b.right <= ob.x + ob.w) return null;
        if (ob.type === 'kicker' && b.centre >= ob.x && b.centre <= ob.x + ob.w) {
          return groundY - (ob.h * (b.centre - ob.x)) / ob.w;
        }
      }
      return groundY;
    },
    ramp() {
      const b = boardSpan(run, cfg);
      for (const ob of run.world.obstacles) {
        if (ob.x > b.centre) break;
        if (ob.type === 'kicker' && b.centre <= ob.x + ob.w) return ob;
      }
      return null;
    },
    grindTarget(prevY, y) {
      const b = boardSpan(run, cfg);
      const tol = cfg.grind.landTolerance;
      for (const ob of run.world.obstacles) {
        if (ob.x > b.right) break;
        // Wheels over the top, centre not yet past the far end (that's rolling off).
        if (!ob.grind || b.right <= ob.x || b.centre > ob.x + ob.w) continue;
        if (prevY <= ob.y + tol && y >= ob.y) return ob;
      }
      return null;
    },
    // Grind to the end: off once the board's centre passes the far end.
    stillOn(ob) {
      return boardSpan(run, cfg).centre <= ob.x + ob.w;
    },
  };
}

function bail(run, reason, seg, cfg) {
  if (run.invincible || run.invuln > 0 || run.down) return;
  run.down = true;
  run.downTime = 0;
  run.crashes++;
  run.boards--;
  if (run.boards <= 0) {
    run.boards = 0;
    run.over = true;
  }
  run.bailReason = reason;
  run.bailSeg = seg;
  run.freeze = cfg.bail.freeze;
  run.shake = cfg.bail.shakeTime;
  bailPlayer(run.player);
  stopWorld(run.world, cfg);
  loseCombo(run.tricks);
  run.events.push({ type: 'bail', reason });
}

// Back on the board: the next clearAhead px of world cleared, speed down by
// speedLoss (recovering in world.js), a moment of invulnerability.
function respawn(run, cfg) {
  const w = run.world;
  const limit = boardSpan(run, cfg).left + cfg.bail.clearAhead;
  w.obstacles = w.obstacles.filter((ob) => ob.x >= limit);
  if (w.nextSpawnX < limit) w.nextSpawnX = limit;
  w.decel = 0;
  w.speedScale = 1 - cfg.bail.speedLoss;
  run.player = createPlayer(cfg);
  run.down = false;
  run.downTime = 0;
  run.invuln = cfg.bail.invulnerable;
  run.events.push({ type: 'respawn' });
}

function gapUnder(run, cfg) {
  const c = boardSpan(run, cfg).centre;
  for (const ob of run.world.obstacles) if (ob.type === 'gap' && c >= ob.x && c <= ob.x + ob.w) return ob;
  return null;
}

function handlePlayerEvents(run, cfg) {
  const evs = run.player.events;
  const s = run.tricks;
  for (let i = 0; i < evs.length && !run.down; i++) {
    const e = evs[i];
    switch (e.type) {
      case 'launch':
        if (!s.live) startCombo(s);
        if (e.kind === 'ollie') addTrick(s, 'ollie', cfg);
        run.events.push(e);
        break;
      case 'flipStart':
        run.events.push(e);
        break;
      case 'flipDone':
        addTrick(s, e.trick, cfg);
        run.events.push({ type: 'trick', trick: e.trick });
        break;
      case 'grindStart':
        addTrick(s, 'grind', cfg);
        run.events.push({ type: 'grind' });
        break;
      case 'grindEnd':
        run.events.push({ type: 'grindEnd' });
        break;
      case 'grindTick':
        addGrindTick(s, cfg);
        break;
      case 'land':
        if (e.result === 'bail') {
          bail(run, 'flip', null, cfg);
        } else if (e.surface === 'ground' && s.live) {
          // A rail landing keeps the combo going; the ground banks it.
          const tricks = s.comboTricks;
          // Copied now: a buffered ollie can start a new combo in this same tick.
          const chain = tricks > 0 ? s.chain.slice() : null;
          const fraction = e.result === 'sketchy' ? cfg.landing.sketchyBank : 1;
          const points = bankCombo(s, fraction);
          run.events.push({ type: 'land', result: e.result, points, tricks, chain });
        }
        break;
      case 'fell': {
        const gap = gapUnder(run, cfg);
        bail(run, 'gap', gap && gap.seg, cfg);
        break;
      }
    }
  }
  evs.length = 0;
}

export function runPress(run, cfg) {
  if (run.down) return;
  pressOllie(run.player, cfg);
  handlePlayerEvents(run, cfg);
}

// action: 'flipL' | 'flipR' | 'flipU' | 'flipD'
export function runFlip(run, action, cfg) {
  if (run.down) return;
  pressFlip(run.player, FLIP_FOR_ACTION[action], cfg);
  handlePlayerEvents(run, cfg);
}

function collectCoins(run, hb, cfg) {
  const list = run.world.coins;
  const half = cfg.coins.size / 2;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (t.x - half > hb.x + hb.w) break;
    if (t.x + half > hb.x && t.y + half > hb.y && t.y - half < hb.y + hb.h) {
      list.splice(i--, 1);
      run.coins++;
      run.events.push({ type: 'coin', x: t.x, y: t.y });
    }
  }
}

export function stepRun(run, dt, cfg) {
  run.ticks++;
  run.time += dt;
  if (run.shake > 0) run.shake = Math.max(0, run.shake - dt);
  if (run.freeze > 0) {
    run.freeze -= dt; // freeze frame: nothing moves
    if (run.down) run.downTime += dt;
    return;
  }
  if (run.invuln > 0) run.invuln = Math.max(0, run.invuln - dt);
  updateWorld(run.world, dt, cfg);
  updatePlayer(run.player, dt, cfg, run.env);

  if (run.down) {
    run.player.events.length = 0;
    run.downTime += dt;
    if (!run.over && run.downTime >= cfg.bail.respawnDelay) respawn(run, cfg);
    return;
  }
  handlePlayerEvents(run, cfg);
  if (run.down) return;

  // Side hits: anything solid the skater overlaps, except the rail being ground
  // (or just dropped off).
  const p = run.player;
  const hb = playerHitbox(p, run.world.distance, cfg, run.hitbox);
  if (!run.invuln && !run.invincible) {
    const list = run.world.obstacles;
    for (let i = 0; i < list.length; i++) {
      const ob = list[i];
      if (ob.x > hb.x + hb.w) break; // sorted by x: nothing further can touch
      if (!ob.solid || ob === p.grinding || ob === p.lastGrind) continue;
      if (overlaps(hb, ob.hit)) {
        bail(run, ob.type, ob.seg, cfg);
        return;
      }
    }
  }
  collectCoins(run, hb, cfg);

  run.score =
    Math.floor(run.world.distance / cfg.score.pxPerPoint) + run.tricks.banked + run.coins * cfg.coins.points;
}
