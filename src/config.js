// Every tuning number lives here. Game code reads CONFIG and never hard-codes a
// gameplay value. Physics is set by target feel (airtime + apex height); the
// raw gravity and launch speed are derived in player.js.
// Values marked (M4), (M5)... are from the plan and get used in that milestone.

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
    maxSpeed: 200, // px/s
    speedRampTime: 180, // s of run time to ease from start to max speed
    cullMargin: 32, // px behind the screen's left edge before an obstacle is dropped
  },

  // Tiers unlock by run time, not score, so trick-heavy players aren't punished.
  tiers: {
    unlockAt: [45, 90, 150], // s: tier 2, 3, 4
    currentTierWeight: 2, // segments of the current tier are this much likelier than older ones
  },

  physics: {
    ollieAirtime: 0.6, // s
    ollieApex: 32, // px
    kickerAirtime: 0.9, // s
  },

  timing: {
    jumpBuffer: 0.12, // s: a tap in the air this close to landing ollies on landing
    lateLandingGrace: 0.06, // s: land with this much flip left (or less) = SKETCHY; more = bail
    coyoteTime: 0.08, // s after rolling off a rail end (or into a gap) when a tap still ollies
  },

  input: {
    swipeDistance: 20, // CSS px the finger must move to count as a swipe
    swipeTime: 0.25, // s after touch-down within which the move must happen
  },

  // Flip duration (s) and points per trick. Grind points are per grind tick.
  tricks: {
    ollie: { points: 10 },
    kickflip: { duration: 0.35, points: 100 },
    heelflip: { duration: 0.35, points: 100 },
    shoveit: { duration: 0.3, points: 80 },
    treflip: { duration: 0.45, points: 250 },
    grind: { points: 5 },
  },

  landing: {
    sketchyBank: 0.5, // fraction of the combo banked on a sketchy landing
  },

  grind: {
    tickTime: 0.1, // s per grind scoring tick
    landTolerance: 3, // px below a rail top that still counts as landing on it
  },

  gap: {
    fallDepth: 4, // px below the ground over a gap before it counts as falling in
  },

  skater: {
    spriteW: 16,
    spriteH: 24,
    hitboxW: 10, // smaller than the sprite so near misses feel fair
    hitboxH: 20,
  },

  // Sizes (px). Ledge, rail and gap widths are set per segment.
  obstacles: {
    hitboxInset: 1, // px inside the sprite on the left, right and top
    lowBlock: { w: 8, h: 8 }, // cone
    tallBlock: { w: 12, h: 16 }, // trash can
    ledge: { h: 12 }, // bench / ledge, 24-64 wide
    rail: { h: 14 }, // handrail / flat bar, 48-120 wide
    kicker: { w: 24, h: 10 },
  },

  spawn: {
    openingClear: 5, // s at the start of a run with no obstacles on screen
    lookahead: 32, // px beyond the widest screen where obstacles are created
    gapPadding: 0.4, // s: min space between segments = speed x (ollie airtime + this)
    randomExtra: 1.0, // s: random extra space between segments, 0 to this
    // s of travel to keep clear after a segment's last obstacle, by type
    // (kicker flight, falling off a rail end)
    tail: { kicker: 1.0, rail: 0.25, ledge: 0.25 },
  },

  score: {
    pxPerPoint: 10, // distance score: 1 point per this many px travelled
    // Points for a trick's 1st, 2nd, 3rd+ time in the same combo.
    repeatFactors: [1, 0.5, 0.25],
  },

  // Coins go in the wallet (spent in the shop) and each also adds points to the score.
  coins: {
    points: 50, // added straight to the score
    size: 8, // px, pickup box
    spacing: 20, // px between coins along a rail or ledge
    arc: [0.3, 0.5, 0.7], // fractions of ollie airtime: coins along the arc over an obstacle
    kickerArc: [0.4, 0.5, 0.6], // fractions of kicker airtime: coins around the kicker apex
    spinFrameTime: 0.1, // s per spin frame
  },

  lives: {
    start: 3, // boards per run; there are no extra boards
  },

  // Gear prices in coins, by item tier (items are listed in gear.js). A run
  // collects roughly 50-100 coins.
  shop: {
    prices: { free: 0, cheap: 100, mid: 300, high: 750, top: 2000 },
    previewRide: 2.0, // s the shop preview rides before showing a kickflip
    previewFlip: 0.5, // s of the preview's kickflip
    previewHop: 10, // px the preview hops for the kickflip (before 2x)
    msgTime: 1.5, // s a shop message ("NOT ENOUGH COINS") stays up
  },

  bail: {
    freeze: 0.05, // s of freeze frame on impact
    shakeTime: 0.15, // s of screen shake
    shakePx: 3, // px
    slideTime: 0.4, // s for the world to slide to a stop after a bail
    respawnDelay: 1.5, // s from bail to respawn
    clearAhead: 200, // px of world cleared ahead of the skater on respawn
    invulnerable: 1.0, // s of invulnerability after respawn (skater blinks)
    speedLoss: 0.15, // speed drops by this fraction on a bail...
    speedRecover: 5, // ...and recovers over this many s
    gameOverDelay: 1.0, // s of the last bail before the game-over screen
    retryDelay: 0.5, // s before a tap can restart (stops accidental restarts)
    boardSlideSpeed: 60, // px/s the board skids ahead after a bail
    boardSlideMax: 40, // px
    blinkRate: 12, // invulnerability blinks per s
  },

  tutorial: {
    retryDelay: 1.0, // s after a tutorial bail before rewinding to the last checkpoint
  },

  // Autopilot (attract mode, soak tests). It plans by simulating ahead.
  bot: {
    horizon: 120, // ticks simulated when checking whether waiting is safe
    depth: 3, // jumps planned ahead
    lookback: 80, // ticks before a predicted bail to consider acting
    checkInterval: 12, // ticks between checks while the road ahead is safe
    budget: 200000, // max simulated ticks per decision before giving up
    minWindow: 6, // soak test: a jump with fewer ticks of timing slack than this is too tight for a human
    flipChance: 0.6, // attract mode: chance to flip instead of a plain ollie
  },

  audio: {
    master: 0.8,
    music: 0.32,
    sfx: 0.8,
    muteRamp: 0.05, // s: mute fades the master over this
    musicBpm: [120, 132, 144, 156], // tempo steps up with each tier
    lookahead: 0.1, // s of music scheduled ahead on the audio clock
    schedulerInterval: 25, // ms between scheduler runs
    grindLevel: 0.07,
  },

  haptics: {
    bail: 30, // ms buzz
    bigCombo: [40, 60, 40], // double pulse for combos over bigComboPoints
    bigComboPoints: 1000,
  },

  // Beating the #1 score in the high-score table during a run.
  best: {
    bannerTime: 1.2, // s the NEW BEST! banner stays up
  },

  ui: {
    blinkPeriod: 0.5, // s per on/off phase of blinking prompts
    rollFrameTime: 0.12, // s per rolling animation frame
    rotateFrameTime: 0.8, // s per frame of the rotate-your-phone animation
    comboHoldTime: 1.0, // s the trick chain stays up after landing, with the result
    popupTime: 1.0, // s a popup stays up
    popupRise: 6, // px a popup drifts up over its life
  },

  render: {
    skylineParallax: 0.25, // far skyline scroll speed relative to the street
    midParallax: 0.5, // mid buildings
    phaseTime: 45, // s of run time per sky phase: sunset, dusk, twilight, night
    lampFlicker: 1.2, // s the street lamps flicker as they come on at dusk
    flashPoints: 1000, // one-frame white flash for combos over this
    particles: 96, // pool size: allocated once, never garbage-collected mid-run
  },

  crt: {
    autoScale: 3, // scanline overlay on by default at this scale and up
  },

  // Skater animation timing (s).
  anim: {
    popTime: 0.1, // ollie snap frame at take-off
    squashTime: 0.1, // squash frame on landing
    pushEvery: 2.4, // a kick-push this often while cruising
    pushFrameTime: 0.12,
    tumbleFrameTime: 0.14, // bail wipeout frames
    getUpTime: 0.3, // back on the board before the respawn
  },

  debug: {
    statWindow: 0.5, // s over which FPS / frame-time stats are averaged
    textRefresh: 0.25, // s between debug text updates
    slowMotion: 0.25, // time scale of the slow-motion toggle
  },

  attract: {
    seed: 20261009, // fixed seed for the title-screen demo run
    restartAfter: 75, // s: the demo starts over (keeps it at a watchable speed)
    botBudget: 40000, // smaller planning budget than the soak test: keeps frames smooth
    panelTime: 5, // s per title panel (how to play / high scores / stats)
  },

  boot: {
    duration: 2.0, // s of fake boot text, once per session (tap skips)
  },

  countdown: {
    step: 0.6, // s per number of the 3-2-1 after a pause
  },

  menus: {
    initialsLockout: 0.6, // s before taps count on the initials screen
  },
};
