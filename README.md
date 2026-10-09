# PIXEL GRIND

Endless side-scrolling pixel-art skater for phone browsers. Vanilla JS (ES modules) + Canvas 2D, no engine, no external assets. The full design is in [skater-game-plan.md](skater-game-plan.md).

## Run it

```
npm install
npm run dev
```

To open it on a phone on the same Wi-Fi: `npm run dev -- --host`, then visit the Network URL Vite prints.

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The build id at the bottom right of the title screen shows which commit a phone is running.

## Testing tools

- `?debug=1` (or the backtick key): FPS, frame time, CPU time per frame, hitboxes, resolution, speed, flip state, seed.
- Tuning panel: in debug mode, tap **TUNE** (bottom-left) or press T. Sliders change the gameplay numbers live; **COPY VALUES** copies them as JSON to paste back into `src/config.js`. Values reset on reload.
- `?seed=12345`: replay a run with a fixed seed.
- Errors print in a red box on screen (tap to dismiss), since phones have no console.

## Controls

Touching the screen pops; the direction you swipe picks the flip.

- Phone: tap = ollie. Swipe left / right / down / up = ollie + kickflip / heelflip / pop shove-it / 360 flip. Swipe in the air for a flip (one more can queue).
- Keyboard: Space = ollie, arrows = flips, P / Esc = pause, backtick = debug overlay, T = tuning panel (debug mode).

Landing with the flip finished is clean; with 60 ms or less of spin left it's SKETCHY (half points); more than that is a bail.

## Layout

All tuning numbers live in `src/config.js`. `run.js`, `world.js`, `player.js`, `collision.js` and `rng.js` have no DOM access, so runs can be simulated headless.
