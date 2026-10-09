// Skater physics: ollie, flips, flip queue, jump buffer, landing rules, bail.
// No DOM access, so runs can be simulated headless (bot soak tests in M3).
// Things that happen are pushed to p.events for run.js to score:
//   { type: 'launch' }                     left the ground (ollie)
//   { type: 'flipDone', trick }            a flip finished spinning
//   { type: 'land', result }               'clean' | 'sketchy' | 'bail'

// gravity = 8 x apex / airtime^2, from the plan. Derived every call so the
// tuning panel can change the targets live.
export function gravity(cfg) {
  const p = cfg.physics;
  return (8 * p.ollieApex) / (p.ollieAirtime * p.ollieAirtime);
}

// launch speed = gravity x airtime / 2
export function launchSpeed(cfg, airtime) {
  return (gravity(cfg) * airtime) / 2;
}

export function createPlayer(cfg) {
  return {
    y: cfg.world.groundY, // feet (bottom of the sprite), px
    vy: 0, // px/s, positive is down
    onGround: true,
    buffer: 0, // s left on a buffered ollie
    airTime: 0,
    flip: null, // trick spinning now
    flipTime: 0, // s into the current flip
    flipDur: 0,
    queued: null, // next flip, starts when the current one finishes (max 1)
    bailed: false,
    bailTime: 0,
    anim: 0,
    events: [],
  };
}

function launch(p, cfg) {
  p.vy = -launchSpeed(cfg, cfg.physics.ollieAirtime);
  p.onGround = false;
  p.buffer = 0;
  p.airTime = 0;
  p.events.push({ type: 'launch' });
}

function startFlip(p, trick, cfg, elapsed) {
  p.flip = trick;
  p.flipDur = cfg.tricks[trick].duration;
  p.flipTime = elapsed;
}

export function pressOllie(p, cfg) {
  if (p.bailed) return;
  if (p.onGround) launch(p, cfg);
  else p.buffer = cfg.timing.jumpBuffer;
}

// On the ground a flip is ollie + flip in one gesture. In the air it starts
// straight away, or queues behind the one spinning (max 1 queued).
export function pressFlip(p, trick, cfg) {
  if (p.bailed) return;
  if (p.onGround) {
    launch(p, cfg);
    startFlip(p, trick, cfg, 0);
  } else if (!p.flip) {
    startFlip(p, trick, cfg, 0);
  } else if (!p.queued) {
    p.queued = trick;
  }
}

function advanceFlip(p, dt, cfg) {
  p.flipTime += dt;
  while (p.flip && p.flipTime >= p.flipDur - 1e-9) {
    const over = p.flipTime - p.flipDur;
    p.events.push({ type: 'flipDone', trick: p.flip });
    if (p.queued) {
      startFlip(p, p.queued, cfg, over);
      p.queued = null;
    } else {
      p.flip = null;
      p.flipTime = 0;
    }
  }
}

// Seconds of spinning left: the current flip plus any queued one.
export function flipRemaining(p, cfg) {
  if (!p.flip) return 0;
  return p.flipDur - p.flipTime + (p.queued ? cfg.tricks[p.queued].duration : 0);
}

function land(p, cfg) {
  p.y = cfg.world.groundY;
  p.vy = 0;
  p.onGround = true;
  if (p.bailed) {
    // Already bailed in the air (hit an obstacle): just fall.
    p.flip = null;
    p.queued = null;
    return;
  }
  const remaining = flipRemaining(p, cfg);
  let result;
  if (remaining <= 1e-9) result = 'clean';
  else if (remaining <= cfg.timing.lateLandingGrace + 1e-9) {
    result = 'sketchy';
    p.events.push({ type: 'flipDone', trick: p.flip }); // close enough: it counts
  } else result = 'bail';
  p.flip = null;
  p.queued = null;
  p.flipTime = 0;
  p.events.push({ type: 'land', result });
  if (result !== 'bail' && p.buffer > 1e-9) launch(p, cfg);
  p.buffer = 0;
}

export function updatePlayer(p, dt, cfg) {
  p.anim += dt;
  if (p.bailed) p.bailTime += dt;
  if (p.onGround) return;

  if (p.flip) advanceFlip(p, dt, cfg);

  // Exact integration for constant gravity, so airtime and apex match config.
  const g = gravity(cfg);
  p.y += p.vy * dt + 0.5 * g * dt * dt;
  p.vy += g * dt;
  p.airTime += dt;

  if (p.y >= cfg.world.groundY - 1e-6) land(p, cfg);
  else if (p.buffer > 0) p.buffer -= dt;
}

export function bailPlayer(p) {
  p.bailed = true;
  p.bailTime = 0;
  p.buffer = 0;
  p.flip = null;
  p.queued = null;
}

export function playerHitbox(p, distance, cfg, out) {
  const s = cfg.skater;
  out.x = distance + cfg.world.skaterX + (s.spriteW - s.hitboxW) / 2;
  out.y = p.y - s.hitboxH;
  out.w = s.hitboxW;
  out.h = s.hitboxH;
  return out;
}
