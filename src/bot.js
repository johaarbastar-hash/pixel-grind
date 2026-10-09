// Autopilot for attract mode and soak tests. No DOM access.
//
// It plans by simulation: runs are deterministic, so it clones the run and
// plays the future forward.
// 1. Ride on without input. If that stays safe for the horizon, wait.
// 2. Otherwise try popping at each tick in the window before the predicted
//    bail. Keep the timings that survive until back in control (landed or
//    grinding), and look at how far each one gets before the next predicted
//    bail.
// 3. Prefer timings that get past the danger, picking the middle of the
//    widest such window (the most forgiving timing), and check that a safe
//    plan exists for the next jumps too (depth-limited).
// Bails it can't plan around point at unfair segments.

import { cloneRun, stepRun, runPress, runFlip } from './run.js';
import { canPop } from './player.js';
import { createRng } from './rng.js';
import { FLIP_ACTIONS } from './tricks.js';

function act(run, action, cfg) {
  if (action === 'press') runPress(run, cfg);
  else runFlip(run, action, cfg);
}

export function createBot(cfg, { flips = false, seed = 1 } = {}) {
  const dt = 1 / cfg.loop.hz;
  const rng = createRng(seed); // the bot's own randomness: never the run's
  let planTick = -1;
  let planAction = null;
  let nextCheck = 0;
  let spent = 0; // sim ticks used by the current decision

  // last: the most recent pop decision: timing window (ticks of slack) and the
  // segment it was for. Soak tests flag windows too tight for a human.
  const stats = { plans: 0, noPlan: 0, simTicks: 0, overBudget: 0, last: null };

  function clone(state) {
    const s = cloneRun(state, cfg);
    s.invincible = false;
    return s;
  }

  // Rides on without input. Returns { safe, bailAt, popTicks } (ticks from now).
  function wait(state) {
    const s = clone(state);
    const popTicks = [];
    for (let i = 0; i < cfg.bot.horizon; i++) {
      if (canPop(s.player)) popTicks.push(i);
      stepRun(s, dt, cfg);
      spent++;
      if (s.down) return { safe: false, bailAt: i, popTicks, seg: s.bailSeg };
    }
    return { safe: true, bailAt: Infinity, popTicks, seg: null };
  }

  // Acts at tick k, then plays until back in control. Returns that state or null.
  function tryAt(state, k, action) {
    if (spent > cfg.bot.budget) return null;
    const s = clone(state);
    const start = s.ticks;
    for (let i = 0; i < k; i++) {
      stepRun(s, dt, cfg);
      if (s.down) break;
    }
    if (!s.down) {
      act(s, action, cfg);
      let left = !canPop(s.player);
      for (let i = 0; i < 240 && !s.down; i++) {
        stepRun(s, dt, cfg);
        const can = canPop(s.player);
        if (!can) left = true;
        else if (left) break;
      }
    }
    spent += s.ticks - start;
    return s.down ? null : s;
  }

  // Returns { k } (ticks to wait before popping; -1 = no pop needed) or null.
  // At depth 0 the lookahead ends: alive and in control counts as fine.
  function plan(state, depth, pre) {
    if (depth <= 0) return { k: -1 };
    const w = pre || wait(state);
    if (w.safe) return { k: -1 };
    if (spent > cfg.bot.budget) return null;

    const cands = [];
    for (const k of w.popTicks) {
      if (k > w.bailAt || k < w.bailAt - cfg.bot.lookback) continue;
      const after = tryAt(state, k, 'press');
      if (!after) continue;
      const w2 = wait(after);
      // Ticks from now until the next predicted bail after this pop.
      const next = w2.safe ? Infinity : after.ticks - state.ticks + w2.bailAt;
      cands.push({ k, after, w2, next, past: next > w.bailAt });
    }

    // Contiguous windows of timings that get past the danger, widest first,
    // each tried from its middle outwards; then everything else.
    const windows = [];
    let cur = null;
    for (const c of cands) {
      if (c.past && cur && c.k === cur[cur.length - 1].k + 1) cur.push(c);
      else if (c.past) windows.push((cur = [c]));
      else cur = null;
    }
    windows.sort((a, b) => b.length - a.length);
    const order = [];
    for (const win of windows) {
      const mid = (win.length - 1) / 2;
      for (const c of win) c.window = win.length;
      win.map((c, i) => [c, Math.abs(i - mid)]).sort((a, b) => a[1] - b[1]).forEach(([c]) => order.push(c));
    }
    cands.filter((c) => !c.past).sort((a, b) => b.next - a.next).forEach((c) => order.push(c));

    for (const c of order) {
      if (plan(c.after, depth - 1, c.w2)) return { k: c.k, window: c.window || 1, seg: w.seg };
      if (spent > cfg.bot.budget) break;
    }
    return null;
  }

  // Attract mode: swap a plain pop for a flip when that is just as safe.
  function chooseAction(state, k) {
    if (!flips || !rng.chance(cfg.bot.flipChance)) return 'press';
    const flip = rng.pick(FLIP_ACTIONS);
    const after = tryAt(state, k, flip);
    return after && plan(after, cfg.bot.depth - 1) ? flip : 'press';
  }

  return {
    stats,
    reset() {
      planTick = -1;
      planAction = null;
      nextCheck = 0;
    },
    // Call once per tick before stepRun; returns an action or null.
    decide(run) {
      const t = run.ticks;
      if (run.down) return null;
      if (planTick === t) {
        planTick = -1;
        nextCheck = t + 1;
        return planAction;
      }
      if (planTick > t || t < nextCheck || !canPop(run.player)) return null;
      stats.plans++;
      spent = 0;
      const res = plan(run, cfg.bot.depth);
      const action = res && res.k >= 0 ? chooseAction(run, res.k) : null;
      stats.last = res && res.k >= 0 ? { window: res.window, seg: res.seg, tick: t } : null;
      stats.simTicks += spent;
      if (spent > cfg.bot.budget) stats.overBudget++;
      if (!res) {
        stats.noPlan++;
        nextCheck = t + 1;
        return null;
      }
      if (res.k < 0) {
        nextCheck = t + cfg.bot.checkInterval;
        return null;
      }
      if (res.k === 0) {
        nextCheck = t + 1;
        return action;
      }
      planTick = t + res.k;
      planAction = action;
      return null;
    },
  };
}
