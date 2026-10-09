# PIXEL GRIND

Endless side-scrolling pixel-art skater for phone browsers. Vanilla JS (ES modules) + Canvas 2D, no engine, no external assets. The full design is in [skater-game-plan.md](skater-game-plan.md).

## Run it

```
npm install
npm run dev
```

To open it on a phone on the same Wi-Fi: `npm run dev -- --host`, then visit the Network URL Vite prints.

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The build id at the bottom right of the title screen shows which commit a phone is running.

## Controls

Touching the screen pops; the direction you swipe picks the flip.

- Phone: tap = ollie. Swipe left / right / down / up = ollie + kickflip / heelflip / pop shove-it / 360 flip. Swipe in the air for a flip (one more can queue).
- Keyboard: Space = ollie, arrows = flips, P / Esc = pause, backtick = debug overlay, T = tuning panel (debug mode).
- Grinding is automatic: land on top of a rail or ledge. Tap (or swipe) to pop off, or ride to the end.
- Kickers launch you higher: enough air for two flips. Swipe on the ramp and the flip starts at the lip.

Landing with the flip finished is clean; with 60 ms or less of spin left it's SKETCHY (half points); more than that is a bail. On a rail, a sketchy landing just keeps the combo going.

## Obstacles and difficulty

Obstacles come in hand-authored segments (`src/segments.js`), each tagged with the tier it unlocks at. Tiers unlock by run time (45 / 90 / 150 s) and speed eases from 100 to 200 px/s over 180 s. Spacing inside a segment stretches with speed, and the space between segments is never less than speed x (ollie airtime + 0.4 s). The first run starts with a 30-second tutorial (bails rewind to the last checkpoint).

## Testing tools

- `?debug=1` (or the backtick key): FPS, frame time, CPU time per frame, hitboxes, resolution, speed, flip state, tier, segment, seed.
- Tuning panel: in debug mode, tap **TUNE** (bottom-left) or press T. Sliders change the gameplay numbers live; **COPY VALUES** copies them as JSON to paste back into `src/config.js`. Values reset on reload. The debug section has invincible, slow motion, autopilot, fixed tier, spawn a chosen segment next, and tutorial on next run.
- `?seed=12345`: replay a run with a fixed seed. `?tutorial=1`: force the tutorial. `?bot=1`: autopilot.
- `?tier=3&speed=180&seg=rail-gap`: fixed tier, fixed speed, one segment on repeat (soak-test replays).
- Errors print in a red box on screen (tap to dismiss), since phones have no console.

### Soak test

```
npm run soak
```

The autopilot (`src/bot.js`) plans every jump by simulating the run ahead. The soak test sweeps every segment at every tier it appears in, at that tier's lowest, middle and highest speed, then plays 10 simulated minutes per tier of random segments. It fails on any bail, and on any jump with less than 0.1 s of timing slack (the bot is frame-perfect; people aren't). Each failure prints a replay URL.

## Layout

All tuning numbers live in `src/config.js`. `run.js`, `world.js`, `player.js`, `collision.js`, `segments.js`, `score.js`, `bot.js`, `tutorial.js` and `rng.js` have no DOM access, so runs can be simulated headless.
