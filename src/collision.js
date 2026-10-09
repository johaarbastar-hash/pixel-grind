// Obstacle types and hitboxes. Each obstacle is a gameplay type; themes only
// change how it looks (see sprites.js).
//   lowBlock, tallBlock   solid: ollie over, any hit = bail
//   ledge, rail           solid, grindable: land on top to grind, side hit = bail
//   kicker                ramp: riding up it launches you
//   gap                   hole in the ground: be airborne across it

const SOLID = { lowBlock: true, tallBlock: true, ledge: true, rail: true };
const GRINDABLE = { ledge: true, rail: true };

export function makeObstacle(type, x, cfg, width, seg) {
  const size = cfg.obstacles[type] || {};
  const w = width ?? size.w;
  const h = size.h || 0;
  const y = cfg.world.groundY - h;
  const inset = cfg.obstacles.hitboxInset;
  return {
    type,
    seg: seg || null, // segment id, for debug and soak logs
    x,
    y,
    w,
    h,
    solid: !!SOLID[type],
    grind: !!GRINDABLE[type],
    // 1 px inside the sprite on the left, right and top; flush with the ground.
    hit: { x: x + inset, y: y + inset, w: w - 2 * inset, h: h - inset },
  };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
