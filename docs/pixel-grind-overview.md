# PIXEL GRIND: everything that's in the game

*As of 10 October 2026. Play it on a phone, held sideways: https://johaarbastar-hash.github.io/pixel-grind/*

> **If you're reading this to suggest ideas:** I'm looking for things to add that would make people want "one more run". Section 15 lists what's already planned. Section 16 lists the limits an idea has to fit, and section 17 has some questions to start from.

---

## 1. The game in short

PIXEL GRIND is an endless side-scrolling skateboarding game for phone browsers, styled like an 80s/90s arcade machine. The skater rolls right on their own. You tap to jump (ollie) and swipe to do flip tricks. You jump over cones, trash cans and holes, and land on rails and ledges to grind them. Chaining tricks before you touch the ground builds a combo. The game gets faster and harder the longer you survive. You have 3 boards (lives) per run. Coins on the road go into a wallet you spend in a shop on gear for your skater.

A run usually lasts one to a few minutes. Everything is designed for one thumb.

---

## 2. Controls

One rule: **touching the screen jumps; the direction you swipe picks the flip.** You can touch anywhere on the screen.

| Gesture | On the ground | In the air | On a rail or ledge |
|---|---|---|---|
| Tap | Ollie (jump) | Saved for 0.12 s: if you land in that time, you ollie straight away | Pop off |
| Swipe ← | Ollie + kickflip | Kickflip | Pop off + kickflip |
| Swipe → | Ollie + heelflip | Heelflip | Pop off + heelflip |
| Swipe ↓ | Ollie + pop shove-it | Shove-it | Pop off + shove-it |
| Swipe ↑ | Ollie + 360 flip | 360 flip | Pop off + 360 flip |
| Nothing | Keep rolling | Fall | Grind to the end |

- The jump happens the moment your finger touches. A swipe counts as soon as the finger has moved a short distance, without waiting for it to lift, so ollie + flip is one motion.
- You can queue one more flip while one is spinning.
- Grinding is automatic: land on top of a rail or ledge and you grind it.
- After rolling off the end of a rail you still have 0.08 s to jump.
- Keyboard (computer): Space = ollie, arrow keys = flips, P or Esc = pause, M = mute, S = shop, D = daily run.

---

## 3. How a run works

- The skater stays at the same spot on screen and the street scrolls past.
- **Speed** rises smoothly from 100 to 200 pixels per second over the first 3 minutes, so the game doubles in speed.
- **Difficulty tiers** unlock by time survived, not by score, so doing lots of tricks doesn't make the game harder:
  - Tier 1 from the start: single obstacles
  - Tier 2 at 45 s: pairs
  - Tier 3 at 90 s: short chains
  - Tier 4 at 2 min 30 s: longer chains at top speed
- The music speeds up with each tier: 120, 132, 144, then 156 beats per minute.
- The first 5 seconds of every run are always clear.
- The same seed gives the exact same run on every phone. Wider screens just see further ahead.

### Obstacles

| Obstacle | Size (pixels) | What to do |
|---|---|---|
| Traffic cone | 8 x 8 | Jump over it |
| Trash can | 12 x 16 | Jump over it (it's taller) |
| Concrete ledge | 24-64 wide, 12 high | Land on top to grind, or jump over |
| Handrail | 48-120 wide, 14 high | Land on top to grind, or jump over |
| Hole in the pavement | 24-40 wide at the starting speed, wider as you speed up | Jump across. Fall in and you bail |
| Kicker (wooden ramp) | 24 x 10 | Ride up it to launch high: 0.9 s in the air, enough for 2 flips |

Running into the side of a cone, can, ledge or rail is a bail.

### Obstacle patterns

Obstacles come in **29 hand-made patterns**, each unlocked at a tier. Some examples:
- **Tier 1:** a single cone, two cones, a can, a short rail, a ledge, a small hole, a kicker
- **Tier 2:** can then cone, kicker then hole, kicker into a long rail, hole then cone
- **Tier 3:** cone-can-cone, two rails in a row, two holes, two kickers, ledge-cone-ledge
- **Tier 4:** rail-can-rail, three cones, hole into a rail, can-hole-can, kicker-rail-hole

Patterns from the current tier come up twice as often as older ones, and the same pattern never comes twice in a row. The gaps between patterns grow with speed, so you always have time to react. A computer player tests every pattern at every speed it can appear at. Any pattern that needs pixel-perfect timing (less than 0.1 s of slack) fails the test.

---

## 4. Tricks and scoring

| Trick | Gesture | Spin time | Points |
|---|---|---|---|
| Ollie | Tap | - | 10 |
| Kickflip | Swipe ← | 0.35 s | 100 |
| Heelflip | Swipe → | 0.35 s | 100 |
| Pop shove-it | Swipe ↓ | 0.30 s | 80 |
| 360 flip | Swipe ↑ | 0.45 s | 250 |
| Grind | Land on a rail or ledge | - | 5 every 0.1 s |

- An ollie is in the air for 0.6 s and goes 32 pixels high, so one flip fits. A kicker jump lasts 0.9 s, room for two flips.

### Landing
- **Clean:** the flip has finished when you land. You get full points.
- **SKETCHY!:** 0.06 s or less of spin left when you land. You get half the combo.
- **Bail:** more spin left than that. You crash and lose the combo.

### Combos
- A combo starts when you leave the ground. It carries on through flips and grinds (you can grind, pop off, flip and land on another rail). It ends when you land on the ground.
- **Combo score = trick points x the number of different tricks in it.** For example, kickflip + grind + heelflip is 3 different tricks, so x3.
- Repeating a trick in the same combo scores 50% the 2nd time and 25% after that.
- The trick chain shows mid-screen while you're in the air ("KICKFLIP + GRIND  220 x2"). It stays up for 1 s after you land, with the result ("+440" or "SKETCHY! +220").

### Combo hype tiers
A combo that banks at or above a tier gets that tier's word drawn big above the result, in the tier's colour, with its own sound and a short freeze ("hit-stop"):

| Tier | Points | Colour | Freeze |
|---|---|---|---|
| NICE | 300 | mint | 2 frames |
| RAD | 600 | teal | 3 frames |
| SICK | 1,000 | gold | 4 frames |
| GNARLY | 2,500 | orange | 6 frames |
| LEGENDARY | 5,000 | rose | 8 frames |

- Each tier plays a rising arpeggio, longer and higher than the tier below, instead of the normal combo sound.
- From SICK up, the screen also does a quick zoom punch (1.06x and back over 0.25 s).
- Over 1,000 points there's a one-frame white flash and a vibration; from GNARLY up the vibration is longer.
- While you're still in the air, the combo's running value pulses (big, in the tier's colour) each time it crosses a tier.

### Score
- **Score = distance (1 point per metre) + banked combos + 50 per coin.**
- **NEW BEST:** the moment a run passes the #1 score in the table, a big "NEW BEST!" banner shows for 1.2 s with a short fanfare (once per run). The high score at the top of the screen turns gold and follows your live score from then on.
- There's a top-10 high-score table with 3-letter initials. A fresh game comes with made-up scores to beat: PXG 5000, RAD 4500, SK8 4000 … TAL 500.

---

## 5. Boards (lives) and bails

- **3 boards per run.** There are no extra boards; you can't win more.
- **When you bail:**
  - The screen freezes for a moment and shakes, and the skater tumbles while their board skids away.
  - You lose one board and the combo you were building.
  - After 1.5 s the skater gets back up. The road just ahead is cleared and you're invulnerable (blinking) for 1 s.
  - Your speed drops 15%, then recovers over 5 s.
- When the last board is gone, it's game over.
- The game-over screen says what got you: "HIT A CONE", "HIT A TRASH CAN", "HIT A LEDGE", "HIT A RAIL", "FELL IN A HOLE" or "LANDED MID-FLIP".

---

## 6. Coins and the shop

### Coins
- Spinning gold coins sit on the ideal line: along rails and ledges at grind height, along the arc of a good jump over obstacles, and around the top of a kicker jump. They quietly show you the best route.
- About 90-125 coins appear per minute of play. A good run collects roughly 50-100.
- Each coin adds 50 to your score **and** 1 coin to your wallet. The wallet is kept between runs.
- Your coins for the current run show under your score. The game-over screen shows coins earned and your wallet total.

### Shop
Open it from the title screen or the game-over screen.
- **4 tabs:** HAT, SHIRT, PANTS, BOARD, with 7 items each.
- **Trying things on:** tap an item to see it on a big preview of your skater. The preview rides and does a kickflip, so you see the board's underside.
- **Buying:** BUY (which also puts it on), or EQUIP for things you already own.
- Your gear shows in your runs and on the title-screen demo.

Prices: free, 100, 300, 750 or 2,000 coins. **Everything costs 8,850 coins in total.**

| Tab | Free | 100 | 300 | 750 | 2,000 |
|---|---|---|---|---|---|
| HAT | Cap (teal), No hat | Back cap (rose), Beanie (orange) | Helmet (white) | Headphones | Crown (gold) |
| SHIRT | Rose tee | Teal tee, White tee, Mint tee | Gold tee, Purple tee | Stripes (cream/navy) | - |
| PANTS | Jeans | Rose, Cargo (brown), Grey | Teal, White | Checks (grey/cream) | - |
| BOARD | Classic (gold) | Rose, Teal | Night (purple, gold wheels), Mint | Checker (black/white), Flame (orange/rose) | - |

Board colours are the underside of the deck plus the wheels. You mostly see them during flips.

---

## 7. Playing against friends

### Challenge links
- SHARE on the game-over screen sends a challenge link: "I scored 4,120 in PIXEL GRIND. Beat me:" plus a link that carries the course (the run's seed), the score and your initials (or "YOU" if you've never entered any).
- Opening the link starts challenge mode. The title shows "CHALLENGE FROM XYZ" and "BEAT 4,120", and starting plays that exact course. There's no tutorial in challenge mode, so it really is the same course.
- During the run a line under the high score shows "BEAT 4,120". When you pass it, it flips to "BEATEN!" in gold for 1.5 s, then shows your margin ("+230").
- Game over says "YOU BEAT XYZ BY 230" or "XYZ WINS BY 410". Retry replays the same course, and SHARE sends the same course back with your score and initials.
- TITLE on the game-over screen leaves challenge mode and removes the challenge from the address bar.
- Challenge runs still count for your local high-score table.
- No server is involved: the link itself carries everything.

### Daily run
- The DAILY button on the title (or D on a keyboard) plays today's course. It's built from the date, so everyone gets the same course that day, and there's no tutorial. Attempts are unlimited, and retry stays on the daily course until you go back to the title.
- The HUD says "DAILY RUN" under the high score.
- Your best score and number of attempts for today are saved. A title panel shows "TODAY'S RUN / BEST 3,420 / 3 ATTEMPTS". Game over says "DAILY BEST" when you improve it.
- SHARE from a daily run sends a daily challenge link (?daily=YYYYMMDD with your score and initials). A friend who opens it plays that day's course, with the same challenge screens as above. If it's still the same day for them, the run counts toward their own daily record too.

---

## 8. First-run tutorial

The first run starts with a 30-second guided opening:
1. "TAP TO OLLIE" over a cone
2. "SWIPE FOR A FLIP" with the four directions shown
3. "LAND ON IT TO GRIND" with a rail
4. "KICKERS = 2 FLIPS" with a kicker
5. "GO!", and the normal game starts

A crash during the tutorial rewinds you to the last checkpoint instead of costing a board. It can be replayed from the pause menu.

---

## 9. Screens and menus

- **Boot:** about 2 s of fake arcade boot text ("ROM CHECK … OK"), once per session. A tap skips it.
- **Title:**
  - Logo and a flashing "TAP TO START" (in challenge mode, "CHALLENGE FROM XYZ" and "BEAT 4,120" as well).
  - A computer player skates a demo run in the background.
  - A panel cycles every 5 s: how to play, the high-score table, your stats (runs, total distance, best combo, tricks landed, coins collected), and today's daily run.
  - Your wallet sits in the corner. SHOP and DAILY buttons sit under the panel. On Android there's also an INSTALL button.
- **During a run (HUD):**
  - Top-left: score, with this run's coins under it.
  - Top-centre: the high score (gold once you've passed it this run), and in a challenge run the score to beat under it ("DAILY RUN" in a daily run).
  - Top-right: a pause button, with one board icon per board left beside it.
- **Pause menu:** RESUME, SOUND on/off, CRT on/off, REPLAY TUTORIAL, QUIT.
  - The game pauses itself if you switch apps or turn the phone upright.
  - Resuming counts down 3-2-1.
- **New high score:** pick 3 initials (swipe up/down to change a letter, tap to confirm).
- **Game over:** the cause, score, the challenge result in a challenge run, "DAILY BEST" if you improved today's daily score, how it compares with your best ("NEW BEST BY 320" or "147 SHORT OF YOUR BEST"), best combo, distance, coins, and your rank if you made the top 10. Buttons: SHARE (sends a challenge link, see section 7), SHOP, TITLE. Tap anywhere else to retry.
- **Rotate screen:** held upright, the phone shows an animated "ROTATE YOUR PHONE".

---

## 10. Look

- **Pixel art:** the game draws at 180 pixels tall and 320-400 wide (matching the phone's shape), then scales up by a whole number so pixels stay sharp.
- **16 colours only:** ink (near-black), navy, indigo, purple, magenta, rose, orange, gold, cream, white, teal, mint, slate, steel, brown, skin.
- **Setting:** a city street.
  - **Sky:** goes from sunset to dusk to twilight to night (stars and a moon), changing every 45 s.
  - **Background:** distant skyline, mid buildings with lit windows, and a near street with a fence and lamp posts that flicker on at dusk.
  - These layers scroll at different speeds for depth.
- **Skater:** 16 x 24 pixels with cap, T-shirt, trousers and board. The animations are:
  - riding (2 frames), kick-pushing (4), ollie snap, in the air
  - kickflip (5), heelflip (5), shove-it (4), 360 flip (6)
  - grinding (2), landing squash, wipeout tumble (2), lying down, getting back up
- **Effects:**
  - landing dust, grind sparks, coin sparkle, crash debris
  - screen shake and a freeze frame on crashes
  - a white flash on combos over 1,000, and a freeze plus zoom punch for big combos (see "Combo hype tiers")
  - an optional CRT scanline effect
- **Text:** a blocky 8 x 8 capitals-only font, with arrow symbols and a coin symbol.

---

## 11. Sound and vibration

- **All synthesized in the browser; there are no audio files.**
- **Sound effects:**
  - ollie pop, kicker launch, landing thud, wobbly sketchy landing, flip whoosh
  - grind clank and a looping grind scrape
  - coin bling, a combo arpeggio that rises with bigger combos (and a longer, higher one for each hype tier), crash
  - shop purchase jingle, menu blips, countdown beeps
  - a short sting when you pass your best, game-over jingle, high-score fanfare
- **Music:** a looping chiptune (bass, lead, drums) that speeds up with each difficulty tier. It stops on pause and crash.
- **Vibration (Android):** a short buzz on a crash, a double pulse on combos over 1,000, and a longer pattern for GNARLY and LEGENDARY.

---

## 12. What's saved on the phone

The high-score table, stats, settings (sound, CRT, tutorial done, last initials), coin wallet, owned gear, worn gear, and today's daily best and attempts are all saved in the browser on that phone. **There are no accounts and no online features.** Scores and coins don't move between phones. The only way scores travel between players is a challenge link (section 7).

---

## 13. Platform

- Runs in the phone's web browser. Nothing to download. Held sideways.
- Installable as an app (Add to Home Screen). Once installed it opens fullscreen and **works offline**.
- Built with plain JavaScript and the browser's 2D canvas. No game engine.
- **Everything is generated in code:** the art, font, sound, music and app icon. No image or sound files are used.
- Hosted free on GitHub Pages. Every update goes live about a minute after it's pushed.

---

## 14. Behind the scenes

- **Computer player:** plans moves by simulating the game ahead. It plays the title-screen demo and tests that every obstacle pattern is fair.
- **Debug mode:** shows hitboxes, FPS and live sliders for all the gameplay numbers, so the feel can be tuned on a phone.
- **Tuning:** every gameplay number (speeds, jump height, trick points, prices) lives in one settings file, so balance changes are quick.

---

## 15. Not in the game yet (already on the idea list)

- **Second theme:** a Bastar (Chhattisgarh, India) road with sal forest and village street. Speed breaker instead of cone, parked bicycle instead of trash can, culvert wall as the ledge, bamboo railing as the rail, pothole as the hole.
- **Manuals:** balancing on two wheels to keep a combo alive across flat ground.
- **Grabs, wallrides, and a balance meter for grinds.**
- **Stairs and drops:** more than one ground height.
- **Missions:** 3 at a time, for example "land 2 kickflips in one run".
- **HARDCORE mode:** one board only.
- **Still to decide:** the final name, and the skater's default look.

---

## 16. Limits a new idea has to fit

- **Controls:** one thumb, using a tap and 4 swipe directions. A new move needs a gesture that doesn't clash with these, or must be automatic.
- **Small screen:** 180 pixels tall. Text is 8 x 8 capitals and the skater is 16 x 24, so on-screen elements must be big and simple.
- **16 colours only.** New art has to use the same palette.
- **Phone browser, works offline.** Anything online (shared leaderboards, accounts, multiplayer) would need a server, which the game doesn't have yet. Possible, but a bigger step. Challenge links are the server-free way friends compete today.
- **Fair:** new obstacles have to be possible to clear at every speed with human timing.
- **Short sessions:** runs are a few minutes and should restart instantly.
- **Made in code:** sprites are drawn from small pixel definitions and sounds are synthesized. Ideas that need detailed art or recorded audio are harder.

---

## 17. Questions to start from

- What would make you play "one more run"?
- What would you want to spend coins on besides clothes?
- What should unlock by playing rather than by buying?
- What goals or challenges would keep you coming back each day?
- What new obstacles or tricks would fit one-thumb controls?
- Beyond challenge links, how could friends compete without a server?
- What would make a big combo feel even more exciting?
- What should a second setting look like?
