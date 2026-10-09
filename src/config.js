// Every tuning number lives here. Game code reads CONFIG and never hard-codes a
// gameplay value. Physics is set by target feel (airtime + apex height); the
// raw gravity and launch speed are derived in player.js.
// Values marked (M2), (M3)... are from the plan and get used in that milestone.

export const CONFIG = {
  view: {
    height: 180, // internal resolution height (px)
    minWidth: 320, // internal width flexes between these to match the screen
    maxWidth: 400,
  },

  loop: {
    hz: 60, // fixed simulation rate (updates per second)
    maxFrameTime: 0.25, // s: clamp per-frame elapsed time so a tab switch can't trigger a catch-up storm
    vsyncSnap: 0.0005, // s: frame times this close to a common refresh interval are snapped to it
  },

  world: {
    groundY: 148, // y of the riding surface
    skaterX: 72, // skater's fixed screen x (sprite left edge)
    startSpeed: 100, // px/s
    maxSpeed: 200, // px/s (M3 speed curve)
    cullMargin: 32, // px behind the screen's left edge before an obstacle is dropped
  },

  physics: {
    ollieAirtime: 0.6, // s
    ollieApex: 32, // px
    kickerAirtime: 0.9, // s (M3)
  },

  timing: {
    jumpBuffer: 0.12, // s: a tap in the air this close to landing ollies on landing
    lateLandingGrace: 0.06, // s (M2)
    coyoteTime: 0.08, // s (M3)
  },

  skater: {
    spriteW: 16,
    spriteH: 24,
    hitboxW: 10, // smaller than the sprite so near misses feel fair
    hitboxH: 20,
  },

  obstacles: {
    hitboxInset: 1, // px inside the sprite on the left, right and top
    lowBlock: { w: 8, h: 8 }, // cone
  },

  spawn: {
    openingClear: 5, // s at the start of a run with no obstacles on screen
    lookahead: 32, // px beyond the widest screen where obstacles are created
    gapPadding: 0.4, // s: min gap between groups = speed x (ollie airtime + this)
    randomExtra: 1.6, // s: random extra gap on top of the minimum (M1 spawner; segments replace it in M3)
    pairChance: 0.25, // chance a cone comes as a pair
    pairGap: 2, // px between the two cones of a pair
  },

  score: {
    pxPerPoint: 10, // distance score: 1 point per this many px travelled
  },

  bail: {
    slideTime: 0.4, // s for the world to slide to a stop after a bail
    retryDelay: 0.5, // s before a tap can restart (stops accidental restarts)
    boardSlideSpeed: 60, // px/s the board skids ahead after a bail
    boardSlideMax: 40, // px
  },

  ui: {
    blinkPeriod: 0.5, // s per on/off phase of blinking prompts
    rollFrameTime: 0.12, // s per rolling animation frame
    rotateFrameTime: 0.8, // s per frame of the rotate-your-phone animation
  },

  render: {
    skylineParallax: 0.25, // skyline scroll speed relative to the street
  },

  debug: {
    statWindow: 0.5, // s over which FPS / frame-time stats are averaged
    textRefresh: 0.25, // s between debug text updates
  },

  attract: {
    seed: 20261009, // fixed seed for the title-screen run
  },
};
