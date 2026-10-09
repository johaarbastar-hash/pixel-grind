# PIXEL GRIND — Game Plan v2 (handoff for Claude Code)

Working title: **PIXEL GRIND** (placeholder, rename anytime)
Genre: endless side-scrolling skater, arcade style
Platform: phone browser first (touch, landscape), desktop keyboard for testing
Vibe: 80s/90s arcade cabinet. Pixel art, chiptune sound, everything synthesized in code.

v2 changes: auto-grind instead of hold-to-grind, physics and fairness numbers filled in, flexible screen width, bitmap font, phone-testing pipeline, debug tools, tutorial, landing rules, combo rules made exact.

---

## 1. Tech decisions (locked)

- **Vanilla JavaScript (ES modules) + Canvas 2D.** No framework, no engine. ES modules don't load from `file://`, so the game is always served: Vite for local dev (`npm run dev -- --host` to open it on a phone on the same Wi-Fi), GitHub Pages for the real test URL.
- **GitHub repo + GitHub Pages from Milestone 1.** Every push deploys. Phone testing = open one bookmarked URL. HTTPS also unlocks fullscreen, sharing and offline play later.
- **Internal resolution: 180 px tall, width flexes from 320 to 400** to match the screen's aspect ratio. Render to an offscreen canvas at that size, then draw it to the display canvas at a whole-number scale worked out in *device* pixels (`innerWidth × devicePixelRatio`), with `imageSmoothingEnabled = false`. Black letterbox for any leftover. A 20:9 phone in fullscreen is filled exactly (2400×1080 = 400×180 at 6×), where a fixed 320×180 leaves thick side bars.
- **Spawning never depends on screen width.** Obstacles spawn by world distance, so every phone gets the same run; wider screens just see further ahead.
- **Landscape only.** The TAP TO START tap unlocks audio, requests fullscreen and locks to landscape (works on Android Chrome; iPhone Safari supports neither for web pages). In portrait: pause and show a full "ROTATE YOUR PHONE" screen. Don't run gameplay in portrait, it would be about 1× scale.
- **Safe areas:** viewport `viewport-fit=cover`, canvas fitted inside `env(safe-area-inset-*)` so notches and rounded corners never cover the HUD. The flexible width absorbs the lost space.
- **Fixed timestep at 60 updates/sec** with an accumulator. Clamp each frame's elapsed time to 250 ms so a tab switch doesn't trigger a catch-up storm. Render the latest state; 90/120 Hz phones just repeat frames, which is fine for pixel art.
- **Whole-pixel drawing.** Positions stay as floats; round the camera once per frame and round every draw position. No sub-pixel shimmer.
- **Seeded random number generator** for all gameplay randomness. Seed shown in debug mode so any bug can be replayed exactly; attract mode uses a fixed seed.
- **Every tuning number lives in `src/config.js`**: physics, speeds, trick timings, points, spawn rules, grace windows. No magic numbers in game code.
- **Input via Pointer Events** (one code path for touch, mouse and pen) plus keyboard.
- **Art:** one 16-colour palette chosen up front. Sprites as small PNG sheets drawn in Piskel (free, runs in the browser) or as pixel arrays in `sprites.js`. Never scale or rotate a sprite at runtime: squash, stretch and the bail tumble are drawn frames, because runtime scaling mixes pixel sizes and breaks the look. No downloaded or copyrighted sprites.
- **Font: bitmap font drawn in code** (8×8 glyphs: A–Z, 0–9, `! ? . , : - + x / %`). Canvas text from a web font gets anti-aliased into grey fuzz at 8 px, has to wait for the font to load, and breaks offline play, so Press Start 2P is dropped.
- **Sound:** Web Audio API only, all synthesized. Music runs on a lookahead scheduler tied to the audio clock, not `setTimeout` per note.
- **Storage:** localStorage wrapped in try/catch for high scores, settings and stats. The game works fully if storage is blocked.

### File structure
```
/index.html
/style.css            page lock-down + CRT overlay
/src/main.js          loop, state machine (boot, title, tutorial, play, pause, gameover, initials)
/src/config.js        every tuning number
/src/rng.js           seeded RNG
/src/input.js         pointer + keyboard → actions (ollie, flipL/R/U/D, pause)
/src/player.js        physics, flips, grind, landing rules, bail, respawn
/src/world.js         scrolling, speed curve, segment spawning
/src/segments.js      hand-authored obstacle patterns with difficulty tiers
/src/collision.js     obstacle types, hitboxes
/src/tricks.js        trick table
/src/score.js         combo, multiplier, repeat decay, tokens, lives
/src/render.js        offscreen canvas, scaling, shake, pooled particles
/src/font.js          bitmap font
/src/sprites.js       palette, sprite data / sheet loading, theme skins
/src/audio.js         SFX + music scheduler
/src/ui.js            HUD, title, pause menu, game over, initials, tutorial prompts
/src/bot.js           autopilot for attract mode and soak tests
/src/debug.js         overlay, tuning panel, on-screen errors
/src/storage.js       scores, settings, stats
/manifest.json        (Milestone 8)
/sw.js                (Milestone 8)
```

---

## 2. Controls

One rule: **touching the screen pops; the direction you swipe picks the flip.**

**Phone (one thumb, anywhere on screen):**
| Gesture | On ground | In air | On a rail or ledge |
|---|---|---|---|
| Tap | Ollie | Buffered: if you land within 120 ms, you ollie on landing | Pop off (ollie) |
| Swipe left / right / down / up | Ollie + kickflip / heelflip / shove-it / 360 flip in one gesture | That flip (queues if one is already spinning, max 1 queued) | Pop off + that flip |
| Nothing | Roll | Fall | Grind to the end of the rail |

**Grinding is automatic.** Land on top of a rail, bench or ledge and you lock into a grind. No holding.

Swipe detection:
- Ollie fires on `pointerdown`, same frame.
- A swipe is recognised the moment the finger has moved 20+ CSS px within 250 ms of touching down. Don't wait for the finger to lift.
- Direction = the axis with the larger movement.
- One flip per touch. Lift and touch again for the next one.
- Touches that start on the pause button never ollie.

**Keyboard (desktop testing):** Space = ollie / pop; arrow keys = flips (on the ground an arrow = ollie + flip, same as a swipe); P or Esc = pause; M = mute; backtick = debug overlay.

**Browser lock-down (all required):**
- `touch-action: none` on the canvas; pointer listeners with `passive: false` and `preventDefault`.
- `overscroll-behavior: none` on `html` and `body` (stops Android pull-to-refresh on swipe down).
- `user-select: none`, `-webkit-touch-callout: none`, no context menu on long press.
- Viewport meta: `width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover`.
- Known limit: edge-swipe "back" gestures (iPhone Safari, Android gesture navigation) can't be blocked from a web page. Fullscreen and the installed app (Milestone 8) reduce it. Known behaviour, not a bug.

---

## 3. Core gameplay

- Skater stays at x = 72; the world scrolls left.
- One flat ground level in v1. Stairs and drops come later.

### Physics
Config holds target airtime and apex height; code derives the rest: **gravity = 8 × height ÷ airtime²**, **launch speed = gravity × airtime ÷ 2**. Tune the targets, never the raw physics.

| Setting | Start value | Works out to |
|---|---|---|
| Ollie airtime | 0.60 s | |
| Ollie apex | 32 px | gravity ≈ 711 px/s², pop ≈ 213 px/s |
| Kicker airtime | 0.90 s | launch ≈ 320 px/s, apex ≈ 72 px |
| Start speed | 100 px/s | ≈ 2.5 s warning on a 320-wide screen |
| Max speed | 200 px/s | ≈ 1.2 s warning |
| Speed ramp | eased, start to max over ~180 s of run time | |
| Late-landing grace | 60 ms | |
| Jump buffer | 120 ms | |
| Coyote time (ollie just after rolling off a rail end) | 80 ms | |

Design intent to protect while tuning:
- An ollie fits **one** flip (the 360 flip only if you swipe from the ground). A kicker fits **two**. That's the reason to hit kickers.
- Every obstacle you're meant to ollie has a comfortable timing window (trash can: about 0.2 s at start speed, 0.3 s at max).

### Tricks (starting values)
| Trick | Input | Duration | Points |
|---|---|---|---|
| Ollie | tap | n/a | 10 |
| Kickflip | swipe left | 0.35 s | 100 |
| Heelflip | swipe right | 0.35 s | 100 |
| Pop shove-it | swipe down | 0.30 s | 80 |
| 360 flip | swipe up | 0.45 s | 250 |
| Grind | land on rail/ledge | per 0.1 s | 5 per tick |

### Landing rules
| Flip state when you touch down | Result |
|---|---|
| Finished, or no flip | Clean: combo banked in full |
| 60 ms or less left | "SKETCHY!": combo banked at 50% |
| More than 60 ms left | Bail |

Landing on a rail uses the same rule, except a sketchy rail landing simply keeps the combo going.

### Obstacles
Each obstacle is a gameplay type; themes only change how it looks.

| Type | City skin | Size (w × h px) | Rule |
|---|---|---|---|
| Low block | cone | 8 × 8 | Ollie over. Side hit = bail |
| Tall block | trash can | 12 × 16 | Ollie over, tighter timing. Side hit = bail |
| Ledge | bench, ledge | 24–64 × 12 | Ollie over (short ones) or land on top to grind. Side hit = bail |
| Rail | handrail, flat bar | 48–120 × 14 | Too long to clear: land on top to grind. Side hit = bail |
| Gap | open manhole, ditch | see fairness rules | Be airborne across it. Fall in = bail |
| Kicker | ramp | 24 × 10 | Riding up it launches you at kicker airtime |

Hitboxes: skater 10 × 20 (smaller than the 16 × 24 sprite, so near misses feel fair); obstacles 1 px inside their sprites.

### Spawning and fairness
- Obstacles come in hand-authored **segments** (`segments.js`), short patterns like "cone, cone, rail", each tagged tier 1–4.
- Tiers unlock by run time: tier 2 at 45 s, tier 3 at 90 s, tier 4 at 150 s. By time, not score, so players who do lots of tricks aren't punished with harder obstacles.
- Spacing inside a segment is authored at start speed and stretched by (current speed ÷ start speed).
- Space between segments ≥ current speed × (ollie airtime + 0.4 s).
- Gap width ≤ 0.7 × current speed × ollie airtime (42 px at start speed, 84 px at max).
- First 5 s of every run: no obstacles.
- Every segment must pass the bot soak test (section 7) at every tier it appears in.

### Tutorial
First run only (replayable from the pause menu). A fixed 30-second opening with prompts: cone → "TAP TO OLLIE", open road → "SWIPE FOR A FLIP", rail → "LAND ON IT TO GRIND", kicker → "KICKERS = 2 FLIPS". No boards lost during the tutorial.

### Tokens
Spinning tokens placed on the ideal line (over rails, along ollie arcs, at kicker apex) so they quietly teach the route. 50 points each, added straight to the score.

### Lives and bails
- 3 boards. Extra board every 10,000 points, max 5.
- Bail: 50 ms freeze frame, wipeout frames, 3 px screen shake, crash sound, combo lost, one board gone.
- Respawn after 1.5 s with the next 200 px of world cleared and 1 s of invulnerability (skater blinks).
- Speed drops 15% on a bail and recovers over 5 s.

### Scoring and combos
- A combo runs from leaving the ground until touching the ground again. Grinds keep it alive: ollie → kickflip → grind → pop → heelflip → land is one combo.
- Combo score = sum of trick points × multiplier.
- Multiplier = number of different tricks in the combo (grind counts as one, the ollie doesn't), minimum 1.
- Repeats in the same combo: 2nd time 50% points, 3rd and later 25%.
- Clean landing banks it, sketchy banks 50%, bail loses it.
- Distance: 1 point per 10 px travelled.
- While the combo is live, show the chain and multiplier mid-screen ("KICKFLIP + GRIND x2").

---

## 4. Arcade shell

- **Boot:** about 2 s of fake boot text, tap to skip, once per session.
- **Title / attract mode:** logo, flashing "TAP TO START", bot-driven demo run behind it (fixed seed), high scores and stats cycling every 5 s. The TAP TO START tap unlocks audio and requests fullscreen + landscape lock.
- **HUD:** score top-left, hi-score top-centre, pause button in the top-right corner with the board icons just left of it. Combo chain and trick names pop up mid-screen.
- **Pause menu:** resume, mute, CRT on/off, replay tutorial, quit. Mute lives here instead of an always-visible button, because a second tiny button at this resolution is a mis-tap magnet. M still mutes on keyboard.
- **Auto-pause** when the tab is hidden, the window loses focus, or the phone turns to portrait. Resume with a 3-2-1 countdown.
- **Game over:** "GAME OVER", final score, best combo, distance. Top-10 score → 3-letter initials: swipe up/down to change a letter, tap to confirm it.
- **Share:** button on the game over screen using the Web Share API ("I scored 12,340 in PIXEL GRIND" + link), falling back to copying the text.
- **High score table:** top 10 with initials.
- **Saved:** settings (mute, CRT, tutorial done) and stats (runs, total distance, best combo, tricks landed, shown on the title screen).
- **CRT effect:** a CSS overlay above the canvas (one scanline per game pixel row + slight vignette), costing nothing in the game loop. On by default only at 3× scale or more; below that the scanlines eat too much of the picture.

---

## 5. Sound (all synthesized)

| Event | Sound |
|---|---|
| Ollie | short square-wave "pop" with pitch up |
| Land | low thud + wheel click |
| Sketchy landing | wobbly detuned thud |
| Flip | quick whoosh (filtered noise sweep) |
| Grind | looping metallic noise while grinding |
| Token pickup | classic coin bling (two rising notes) |
| Combo banked | rising arpeggio, higher for bigger combos |
| Bail | noise crash + descending tone |
| Extra board | short 1-up jingle |
| Menu move / select / countdown | blips |
| Game over | sad descending jingle |
| New high score | fanfare |
| Music | looping chiptune (bass + lead + noise drums); tempo steps up with each difficulty tier |

Implementation notes:
- Lookahead scheduler: every ~25 ms, schedule any notes falling in the next ~100 ms on the AudioContext clock.
- Short attack/release envelope on every sound so nothing clicks.
- Master gain → separate music and SFX gains; mute ramps the master to 0 over 50 ms.
- Music and the grind loop stop on pause, bail and game over; the AudioContext resumes when the tab comes back.
- iPhone: the hardware silent switch mutes Web Audio. Known behaviour, not a bug.
- **Haptics:** `navigator.vibrate` short buzz on bail, double pulse on combos over 1,000. Android only; skip silently where unsupported.

---

## 6. Look

- **Theme system:** each theme supplies sprites, palette and background layers for the gameplay types in section 3. Changing theme never touches gameplay code.
- **Theme 1 (build with this):** city street at sunset turning to night.
- **Theme 2 (candidate):** Bastar road, sal forest and village street. Skins like speed breaker = low block, parked cycle = tall block, culvert wall = ledge, bamboo railing = rail, pothole = gap.
- **Parallax:** far skyline, mid buildings, near street with lamps and fences. Each layer pre-rendered once into its own offscreen canvas and tiled; each layer's offset rounded to whole pixels.
- **Sunset to night** in 4 palette phases (sunset, dusk, twilight, night) over about 3 minutes, swapping sky and light colours per phase. No continuous tinting, which would break the 16-colour look. Street lights flicker on at dusk.
- **Skater:** 16 × 24 sprite. Frames: roll (2), push (4), crouch (1), ollie stretch (1), air (1), kickflip (5), heelflip (5), shove-it (4), 360 flip (6), grind (2), land squash (1), bail tumble (4), get up (2). Board drawn 1–2 px longer than realistic, dark grip tape on top, bright underside, so flips read at this size.
- **Effects:** dust puffs on landing, sparks while grinding, screen shake in whole pixels (2–3 px, 150 ms), one-frame white flash on combos over 1,000. Particles come from a fixed pool so garbage collection never stutters the game.

---

## 7. Debug and testing (build alongside, not after)

- **`?debug=1`** in the URL (or the backtick key) shows FPS and frame time, hitboxes, speed, tier, current segment id and seed.
- **Debug toggles:** invincible, slow motion (0.25×), jump to tier N, spawn a chosen segment.
- **Tuning panel:** sliders for everything in `config.js` (airtimes, heights, speeds, flip durations, grace windows). A "COPY VALUES" button puts the JSON on the clipboard to paste back into `config.js`. Tune feel on the phone, not in the code.
- **On-screen error box:** `window.onerror` and unhandled promise rejections print onto the screen, since phones have no console.
- **Bot soak test:** the autopilot (same one that drives attract mode) plays each tier for 10 minutes with invincibility off and logs every bail with segment id and seed. Each logged bail is either an unfair segment or a dumb bot; check every one.

---

## 8. Build milestones for Claude Code

Build in this order. Each one must be live on the GitHub Pages URL and playable on a phone before moving on.

1. **Core loop + pipeline:** repo with GitHub Pages deploying on push; flexible-width offscreen canvas with crisp whole-number scaling and safe areas; fixed timestep; pointer + keyboard input with the full browser lock-down; TAP TO START screen (fullscreen + landscape lock) and rotate screen; skater (placeholder rectangles are fine) on flat ground; scrolling street; tap to ollie with jump buffer; cones that bail with instant restart; distance score; bitmap font; `config.js`; debug overlay and on-screen error box.
2. **Tricks:** swipe detection, ollie + flip gesture, 4 flips with placeholder frames, flip queue, clean / sketchy / bail landing rules, trick name popups, tuning panel.
3. **Obstacles + grind:** all obstacle types and hitboxes, auto-grind and pop-off, coyote time, kickers, seeded RNG, segment library with tiers and fairness rules, speed curve, tutorial run, bot and soak test.
4. **Scoring + lives:** combo rules, multiplier, repeat decay, tokens on the line, 3 boards, respawn, extra boards, full HUD.
5. **Audio:** all SFX, music scheduler with tier tempo, pause menu with mute, haptics.
6. **Arcade shell:** boot, title / attract mode with the bot demo, game over, initials, top-10 table, stats, share, auto-pause with countdown.
7. **Art + polish:** final sprites and palette, parallax, sunset-to-night phases, particles, shake, freeze frame, flash, CRT overlay, theme decision.
8. **App feel:** manifest (fullscreen, landscape, icons), service worker with a versioned cache for offline play, install prompt on Android.
9. **Portfolio (optional):** README with a gameplay GIF and a short write-up of the design decisions (fairness rules, one-thumb controls, how the bot tests every pattern).

### Acceptance checks
- Smooth 60 fps on a mid-range Android phone in Chrome: debug frame time under 16.7 ms, no garbage-collection stutters.
- Ollie on the same frame as the touch; flips recognised before the finger lifts.
- No scrolling, zooming, text selection, pull-to-refresh or long-press menu while playing.
- No side bars on a 20:9 phone in fullscreen.
- Every segment passes the bot soak test at every tier it appears in.
- Works with sound muted, with localStorage blocked, and (after Milestone 8) offline.
- Switching apps mid-run pauses, stops audio, and resumes cleanly with the countdown.
- Tested on at least one real Android phone; iPhone Safari too if one is available.

---

## 9. Open decisions

- **Final name:** check itch.io and the Play Store for clashes before locking it.
- **Skater look:** colours, cap or helmet, hair.
- **Theme:** city for the build; Bastar road as theme 2 (recommended, it's the version nobody else has). Decide at Milestone 7.
- **Lives:** 3 boards is the default. One-hit can come later as a "HARDCORE" toggle.

### Later ideas (after Milestone 8)
- Manuals, to keep combos alive across flat ground (biggest upgrade to combo depth; gesture to be decided).
- Grabs, wallrides, a grind balance meter.
- Stairs and drops (more than one ground height).
- Missions, 3 at a time ("land 2 kickflips in one run").
- Unlockable board and skater colours via palette swaps.
- Daily run: same seed for everyone that day.

---

## 10. Kickoff prompt to paste into Claude Code

> Read `skater-game-plan.md`. Build PIXEL GRIND as described, Milestone 1 only. Vanilla JS ES modules and Canvas 2D, no external assets. Set up a GitHub repo with GitHub Pages deploying on every push and give me the URL to open on my phone (if you can't switch Pages on yourself, tell me exactly what to click). Every tuning number goes in `src/config.js`. Include the debug overlay (`?debug=1`) and the on-screen error box from the start. When Milestone 1 is live, stop and wait for me to test before starting Milestone 2.
