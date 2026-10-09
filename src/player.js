// Skater physics: ollie, jump buffer, landing, bail.
// No DOM access, so runs can be simulated headless (bot soak tests in M3).

// gravity = 8 x apex / airtime^2, from the plan. Derived every call so the
// tuning panel (M2) can change the targets live.
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
    bailed: false,
    bailTime: 0,
    anim: 0,
  };
}

function launch(p, cfg) {
  p.vy = -launchSpeed(cfg, cfg.physics.ollieAirtime);
  p.onGround = false;
  p.buffer = 0;
  p.airTime = 0;
}

export function pressOllie(p, cfg) {
  if (p.bailed) return;
  if (p.onGround) launch(p, cfg);
  else p.buffer = cfg.timing.jumpBuffer;
}

export function updatePlayer(p, dt, cfg) {
  p.anim += dt;
  if (p.bailed) p.bailTime += dt;
  if (p.onGround) return;

  // Exact integration for constant gravity, so airtime and apex match config.
  const g = gravity(cfg);
  p.y += p.vy * dt + 0.5 * g * dt * dt;
  p.vy += g * dt;
  p.airTime += dt;

  const ground = cfg.world.groundY;
  if (p.y >= ground - 1e-6) {
    p.y = ground;
    p.vy = 0;
    p.onGround = true;
    if (p.buffer > 1e-9 && !p.bailed) launch(p, cfg);
    p.buffer = 0;
  } else if (p.buffer > 0) {
    p.buffer -= dt;
  }
}

export function bailPlayer(p) {
  p.bailed = true;
  p.bailTime = 0;
  p.buffer = 0;
}

export function playerHitbox(p, distance, cfg, out) {
  const s = cfg.skater;
  out.x = distance + cfg.world.skaterX + (s.spriteW - s.hitboxW) / 2;
  out.y = p.y - s.hitboxH;
  out.w = s.hitboxW;
  out.h = s.hitboxH;
  return out;
}
