// Bot soak test: every segment must be fair at every tier it appears in.
//   npm run soak                      full test (10 simulated minutes per tier)
//   npm run soak -- --minutes 2       shorter random soak
//
// 1. Lint: authored sizes against the fairness rules.
// 2. Sweep: each segment, at each tier it appears in, at that tier's lowest,
//    middle and highest speed, a few times in a row.
// 3. Soak: each tier for N simulated minutes of random segments, split across
//    the tier's lowest / middle / highest speed.
// Every bail is logged with segment, tier, speed and seed. Each one is either
// an unfair segment or a dumb bot: check every one. Replay in the browser with
// ?debug=1&seed=S&tier=T&speed=V (add &seg=ID for sweep bails).
// The bot is frame-perfect, so surviving isn't enough: jumps whose timing
// window is under CONFIG.bot.minWindow ticks are flagged as too tight.

import { CONFIG } from '../src/config.js';
import { SEGMENTS } from '../src/segments.js';
import { createRun, stepRun, runPress, runFlip } from '../src/run.js';
import { createBot } from '../src/bot.js';
import { speedAt } from '../src/world.js';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const MINUTES = Number(arg('minutes', 10));
const SWEEP_REPEATS = Number(arg('repeats', 3));
const cfg = CONFIG;
const dt = 1 / cfg.loop.hz;

// --- 1. Lint ---------------------------------------------------------------
const lint = [];
const maxGap = 0.7 * cfg.world.startSpeed * cfg.physics.ollieAirtime;
for (const seg of SEGMENTS) {
  if (!(seg.tier >= 1 && seg.tier <= 4)) lint.push(`${seg.id}: tier ${seg.tier} not 1-4`);
  let lastX = -Infinity;
  for (const it of seg.items) {
    if (it.x < lastX) lint.push(`${seg.id}: items not sorted by x`);
    lastX = it.x;
    if (it.type === 'gap' && it.w > maxGap) lint.push(`${seg.id}: gap ${it.w} > ${maxGap} px`);
    if (it.type === 'rail' && (it.w < 48 || it.w > 120)) lint.push(`${seg.id}: rail ${it.w} not 48-120`);
    if (it.type === 'ledge' && (it.w < 24 || it.w > 64)) lint.push(`${seg.id}: ledge ${it.w} not 24-64`);
  }
}

// --- Tier speed ranges from the speed curve ---------------------------------
const bounds = [0, ...cfg.tiers.unlockAt, cfg.world.speedRampTime];
const tierSpeeds = (tier) => {
  const a = bounds[tier - 1];
  const b = Math.max(a, bounds[tier]);
  return [speedAt(a, cfg), speedAt((a + b) / 2, cfg), speedAt(b, cfg)].map((v) => Math.round(v));
};

const bails = [];
const tight = new Map(); // "seg @ tier, speed" -> narrowest window seen (ticks)
let seedCounter = 1000;

function play({ tier, speed, seconds, only = null, seed = seedCounter++ }) {
  let run = createRun(cfg, seed, { spawn: true });
  const bot = createBot(cfg);
  let t = 0;
  let passed = 0;
  let lastSeg = null;
  const setup = (r) => {
    r.world.tierOverride = tier;
    r.world.speedOverride = speed;
    r.world.nextSpawnX = cfg.view.maxWidth + 40; // skip the opening
  };
  setup(run);
  const ticks = Math.round(seconds / dt);
  for (let i = 0; i < ticks; i++) {
    if (only) run.world.forceNext = only;
    const a = bot.decide(run);
    const last = bot.stats.last;
    if (last && last.tick === run.ticks && last.window < cfg.bot.minWindow) {
      const k = `${last.seg ?? '?'} @ tier ${tier}, ${speed} px/s`;
      tight.set(k, Math.min(tight.get(k) ?? Infinity, last.window));
    }
    if (a === 'press') runPress(run, cfg);
    else if (a) runFlip(run, a, cfg);
    stepRun(run, dt, cfg);
    t += dt;
    const ahead = run.world.obstacles.find((o) => o.x + o.w > run.world.distance + cfg.world.skaterX);
    if (ahead && ahead.seg !== lastSeg) {
      lastSeg = ahead.seg;
      passed++;
    }
    if (run.down) {
      bails.push({ tier, speed, seed: run.seed, seg: run.bailSeg, reason: run.bailReason, at: run.time.toFixed(1), only: !!only });
      seed = seedCounter++;
      run = createRun(cfg, seed, { spawn: true });
      setup(run);
      bot.reset();
    }
  }
  return { passed, stats: bot.stats };
}

const t0 = Date.now();

// --- 2. Sweep --------------------------------------------------------------
let sweepRuns = 0;
for (const seg of SEGMENTS) {
  for (let tier = seg.tier; tier <= 4; tier++) {
    for (const speed of tierSpeeds(tier)) {
      // enough time for SWEEP_REPEATS copies of the segment
      play({ tier, speed, seconds: 4 + SWEEP_REPEATS * 4.5, only: seg.id });
      sweepRuns++;
    }
  }
}
const sweepBails = bails.length;

// --- 3. Soak ---------------------------------------------------------------
const soak = [];
for (let tier = 1; tier <= 4; tier++) {
  let passed = 0;
  let plans = 0;
  let noPlan = 0;
  for (const speed of tierSpeeds(tier)) {
    const r = play({ tier, speed, seconds: (MINUTES * 60) / 3 });
    passed += r.passed;
    plans += r.stats.plans;
    noPlan += r.stats.noPlan;
  }
  soak.push({ tier, speeds: tierSpeeds(tier).join('/'), segments: passed, plans, noPlan });
}

// --- Report ----------------------------------------------------------------
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nLINT: ${lint.length ? lint.length + ' problem(s)' : 'ok'}`);
for (const l of lint) console.log('  ' + l);
console.log(`\nSWEEP: ${SEGMENTS.length} segments, ${sweepRuns} segment/tier/speed runs, ${sweepBails} bail(s)`);
console.log(`SOAK: ${MINUTES} simulated min per tier`);
for (const s of soak) console.log(`  tier ${s.tier}  speeds ${s.speeds} px/s  ${s.segments} segments ridden  ${s.plans} plans  ${s.noPlan} no-plan`);
console.log(`\nBAILS: ${bails.length}`);
const bySeg = new Map();
for (const b of bails) {
  const k = `${b.seg ?? '?'} @ tier ${b.tier}, ${b.speed} px/s`;
  if (!bySeg.has(k)) bySeg.set(k, []);
  bySeg.get(k).push(b);
}
for (const [k, list] of bySeg) {
  const b = list[0];
  console.log(`  ${k}: ${list.length}x (${b.reason}${b.only ? ', sweep' : ''})  replay: ?debug=1&seed=${b.seed}&tier=${b.tier}&speed=${b.speed}${b.only ? '&seg=' + b.seg : ''}`);
}
console.log(`\nTIGHT TIMING (under ${cfg.bot.minWindow} ticks of slack): ${tight.size}`);
for (const [k, w] of [...tight].sort()) console.log(`  ${k}: ${w} tick(s)`);
console.log(`\n${secs} s real time`);
process.exit(lint.length || bails.length || tight.size ? 1 : 0);
