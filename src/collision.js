// Obstacle types and hitboxes. Each obstacle is a gameplay type; themes only
// change how it looks (see sprites.js).

export function makeObstacle(type, x, cfg) {
  const size = cfg.obstacles[type];
  const inset = cfg.obstacles.hitboxInset;
  const y = cfg.world.groundY - size.h;
  return {
    type,
    x,
    y,
    w: size.w,
    h: size.h,
    // 1 px inside the sprite on the left, right and top; flush with the ground.
    hit: { x: x + inset, y: y + inset, w: size.w - 2 * inset, h: size.h - inset },
  };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
