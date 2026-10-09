// Skater physics: ollie, flips, flip queue, jump buffer, coyote time, grinding,
// kickers, landing rules, bail. No DOM access, so runs can be simulated
// headless (bot, soak tests).
//
// The world around the skater comes in through `env` (built by run.js):
//   env.floor()               y of the ground / ramp under the board, or null over a gap
//   env.ramp()                kicker under the board's centre, or null
//   env.grindTarget(prevY, y) rail / ledge the board is landing on, or null
//   env.stillOn(ob)           board's centre still over that rail / ledge
//
// Things that happen are pushed to p.events for run.js to score:
//   { type: 'launch', kind }        left a surface: 'ollie' (incl. pop off a rail) or 'kicker'
//   { type: 'flipStart', trick }    a flip started spinning
//   { type: 'flipDone', trick }     a flip finished spinning
//   { type: 'land', result, surface }   'clean' | 'sketchy' | 'bail', on 'ground' | 'rail'
//   { type: 'grindStart' } { type: 'grindTick' } { type: 'grindEnd' }
//   { type: 'fell' }                fell into a gap

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
    ramp: null, // kicker being ridden up
    grinding: null, // rail / ledge being ground
    lastGrind: null, // the one just left (no side hits from it while dropping off)
    grindTime: 0,
    grindTick: 0,
    coyote: 0, // s left to ollie after rolling off an edge
    buffer: 0, // s left on a buffered ollie
    pendingFlip: null, // swiped on a kicker: starts at launch
    airTime: 0,
    rollTime: 1, // s on the ground since landing (animation only)
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

export function clonePlayer(p) {
  return { ...p, events: [] };
}

// Can a tap pop the skater right now?
export function canPop(p) {
  return !p.bailed && (p.grinding !== null || (p.onGround && !p.ramp) || p.coyote > 0);
}

function launch(p, cfg, kind) {
  const airtime = kind === 'kicker' ? cfg.physics.kickerAirtime : cfg.physics.ollieAirtime;
  p.vy = -launchSpeed(cfg, airtime);
  if (p.grinding) {
    p.lastGrind = p.grinding;
    p.events.push({ type: 'grindEnd' });
  }
  p.grinding = null;
  p.onGround = false;
  p.ramp = null;
  p.coyote = 0;
  p.buffer = 0;
  p.airTime = 0;
  p.events.push({ type: 'launch', kind });
}

function startFlip(p, trick, cfg, elapsed) {
  p.flip = trick;
  p.flipDur = cfg.tricks[trick].duration;
  p.flipTime = elapsed;
  p.events.push({ type: 'flipStart', trick });
}

export function pressOllie(p, cfg) {
  if (p.bailed) return;
  if (canPop(p)) launch(p, cfg, 'ollie');
  else if (!p.onGround) p.buffer = cfg.timing.jumpBuffer;
  // On a kicker ramp a tap does nothing: the kicker launches you.
}

// From a surface a flip is ollie + flip in one gesture. On a kicker it waits
// for the launch. In the air it starts straight away, or queues behind the
// one spinning (max 1 queued).
export function pressFlip(p, trick, cfg) {
  if (p.bailed) return;
  if (canPop(p)) {
    launch(p, cfg, 'ollie');
    startFlip(p, trick, cfg, 0);
  } else if (p.ramp) {
    p.pendingFlip = trick;
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

function leaveSurface(p, cfg) {
  p.onGround = false;
  p.ramp = null;
  p.vy = 0;
  p.airTime = 0;
  p.coyote = cfg.timing.coyoteTime;
}

// rail: the rail / ledge landed on, or null for the ground (floorY).
function land(p, cfg, rail, floorY, ramp) {
  p.vy = 0;
  p.coyote = 0;
  p.lastGrind = null;
  if (rail) {
    p.y = rail.y;
    p.grinding = rail;
    p.grindTime = 0;
    p.grindTick = 0;
  } else {
    p.y = floorY;
    p.onGround = true;
    p.ramp = ramp;
    p.rollTime = 0;
  }
  if (p.bailed) {
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
  p.events.push({ type: 'land', result, surface: rail ? 'rail' : 'ground' });
  if (result === 'bail') return;
  if (rail) {
    p.events.push({ type: 'grindStart' });
  } else if (p.buffer > 1e-9 && !ramp) {
    launch(p, cfg, 'ollie'); // buffered tap (not on rails: you came to grind)
  }
  p.buffer = 0;
}

function updateGrind(p, dt, cfg, env) {
  if (!env.stillOn(p.grinding)) {
    // Rolled off the end: fall, with coyote time to still pop.
    p.lastGrind = p.grinding;
    p.grinding = null;
    p.events.push({ type: 'grindEnd' });
    leaveSurface(p, cfg);
    return;
  }
  p.y = p.grinding.y;
  p.grindTime += dt;
  p.grindTick += dt;
  while (p.grindTick >= cfg.grind.tickTime) {
    p.grindTick -= cfg.grind.tickTime;
    p.events.push({ type: 'grindTick' });
  }
}

function updateRolling(p, dt, cfg, env) {
  p.rollTime += dt;
  const floor = env.floor();
  if (floor === null) {
    leaveSurface(p, cfg); // rolled into a gap
    return;
  }
  const ramp = env.ramp();
  if (p.ramp && !ramp && !p.bailed) {
    // Rode off the top of a kicker: launch from the lip.
    launch(p, cfg, 'kicker');
    if (p.pendingFlip) startFlip(p, p.pendingFlip, cfg, 0);
    p.pendingFlip = null;
    return;
  }
  p.ramp = ramp;
  p.y = floor;
}

function updateAir(p, dt, cfg, env) {
  const prevY = p.y;
  if (p.flip) advanceFlip(p, dt, cfg);

  // Exact integration for constant gravity, so airtime and apex match config.
  const g = gravity(cfg);
  p.y += p.vy * dt + 0.5 * g * dt * dt;
  p.vy += g * dt;
  p.airTime += dt;
  if (p.coyote > 0) p.coyote -= dt;

  if (p.vy > 0 && !p.bailed) {
    const rail = env.grindTarget(prevY, p.y);
    if (rail) {
      land(p, cfg, rail, 0, null);
      return;
    }
  }
  const floor = env.floor();
  if (floor !== null) {
    if (p.y >= floor - 1e-6) {
      land(p, cfg, null, floor, env.ramp());
      return;
    }
  } else if (p.y > cfg.world.groundY + cfg.gap.fallDepth) {
    p.events.push({ type: 'fell' });
  }
  if (p.buffer > 0) p.buffer -= dt;
}

export function updatePlayer(p, dt, cfg, env) {
  p.anim += dt;
  if (p.bailed) p.bailTime += dt;
  if (p.grinding) updateGrind(p, dt, cfg, env);
  else if (p.onGround) updateRolling(p, dt, cfg, env);
  else updateAir(p, dt, cfg, env);
}

export function bailPlayer(p) {
  p.bailed = true;
  p.bailTime = 0;
  p.buffer = 0;
  p.flip = null;
  p.queued = null;
  p.pendingFlip = null;
  p.coyote = 0;
  if (p.grinding) {
    p.grinding = null;
    p.onGround = false;
    p.vy = 0;
  }
}

export function playerHitbox(p, distance, cfg, out) {
  const s = cfg.skater;
  out.x = distance + cfg.world.skaterX + (s.spriteW - s.hitboxW) / 2;
  out.y = p.y - s.hitboxH;
  out.w = s.hitboxW;
  out.h = s.hitboxH;
  return out;
}
