# Architecture

Plain ES modules, loaded by `index.html` through `<script type="module" src="js/main.js">`. There are no dependencies and no build step. At deploy time, `tools/stamp.mjs` adds `?v=<commit>` to every import and asset URL.

```
index.html ── js/main.js ─┬─ js/game.js ──┬─ js/court.js     court geometry (metres)
  (DOM)                   │   (no DOM)    ├─ js/powers.js    PowerSystem
                          │               ├─ js/heroes.js    kid profiles, power templates
                          │               └─ js/toon.js      SQUADS (the cartoon heroes)
                          ├─ js/render.js   WebGL 2 / Canvas 2D renderer
                          ├─ js/toon.js     cartoon drawing (heroes, court, ball, flags, crests)
                          ├─ js/tv.js       TV camera view
                          ├─ js/clubs.js    teams, kits, opponents
                          ├─ js/input.js    joystick, buttons, keyboard
                          └─ js/audio.js    synthesised music and sounds
```

## The match: `js/game.js`
`new Game(opts)` holds a whole match: players, ball, rules, referees and AI. It never touches the DOM, so the Node tests (`tests/*.mjs`) run it directly.

**Options:**
- `human`: 0 means you control team 0; -1 means both teams are AI (the menu's demo match).
- `halfLen` (seconds), `difficulty` (`easy`, `normal` or `hard`), `rules` (`arcade` or `full` IHF).
- `hero` and `power`: the kid (`PROFILES` id) who carries the power, and the template key.
- `rivalHero` and `rivalPower`: the computer's kid (optional) and its power. `rivalPowers: false` turns the computer's powers off.
- `lineup`: `{ role: hero }` for your team. `applyLineup()` swaps any duplicate hero out of the rival team.
- `kits`: the two teams' names and colours, from `matchKits()` in `js/clubs.js`.

**Stepping:** `step(dt)` is called at a fixed 60 Hz. `game.input` is the input state (`mx`, `my`, `aPress`, `bPress`, `pPress`, …). `game.events` is a list of things that happened (goal, pass, shot, power, whistle…). `main.js` turns the events into sounds and effects, then clears the list.

**Match states:** `play`, `setpiece` (throw-off, free throw, 7 m, throw-in, goalkeeper throw), `goal`, `halftime`, `fulltime`.

**Ball states:** `held`, `pass`, `shot`, `loose`, `dead`.

**Players:** 7 per team, with the roles `GK LW LB CB RB RW PV`. Each player has `hero` (the look), `effects` (power modifiers), `frozen`, `active` (suspensions) and AI state.

**Notable mechanics:**
- `PACE` (0.72) slows the whole game for kids.
- **Arcade rules:** no 3-step or 3-second calls.
- **Magnetic passes:** `magnet()` steers a pass to the receiver. Your passes are rarely intercepted.
- **Powers:** `powers.activate(team)`:
  - fires at once if your team has the ball;
  - otherwise it is "armed" and fires on the next catch.
  - A close-up splash (`game.splash`, 1.8 s) freezes the match.
- **Ice** freezes the rivals (3 s; only 1.5 s when the computer freezes you).

## Powers: `js/powers.js` and `js/heroes.js`
- **Templates:** `TEMPLATES` in `heroes.js` (`lightning`, `fire`, `muscle`, `ice`, `captain`) give each power:
  - its look: costume, colours, ball kind, close-up text;
  - its `fx`: `speed`, `aim`, `unblockable`, `freezeKeeper`, `keeperSave`, `freezeTeam`, `teamSpeed`/`teamTime`.
- **`PowerSystem`:**
  - fills the meters (yours fills faster than the computer's);
  - applies the modifiers through `mod(player, key)`;
  - starts a power with `start(carrier)`.
- **Kids:** `PROFILES` in `heroes.js` hold the kids' looks: skin, hair colours, `style` (swoop, long, fringe or side), glasses, freckles, mouth, earrings, and their signature `power`.
- **Close-up:** `drawPortrait()` draws the big POWER close-up.
- **On the court:** `heroFromProfile()` and `kidHero()` turn a profile into an in-game hero.

## Drawing: `js/render.js`, `js/toon.js`, `js/tv.js`
**The renderer** (`createRenderer(canvas, { preferGL })`) has one API with two backends:
- **Primitives:** `begin(cx, cy, ppm, clear)`, `ellipse`, `rect(x, y, hw, hh, c, rot, rad)`, `ring`, `line(x1, y1, x2, y2, hw, c)`, `tri(…, round)`, `end()`. Coordinates are in metres; the camera maps them to pixels.
- **WebGL 2:** each primitive is an instance of a quad, shaded by a signed-distance fragment shader. The whole frame is one `drawArraysInstanced` call.
- **Canvas 2D:** the same API, used when WebGL 2 is missing. The small cards in the menus always use Canvas 2D, so the page keeps a single WebGL context.
- **TV floor:**
  - `setFloor(canvas, box)` uploads a top-down drawing of the court.
  - `floor(cam)` draws it in perspective: a full-screen shader in GL, row by row in 2D.

**`toon.js`:**
- `SQUADS`: the two cartoon teams, הצרעות and הצפעונים, with 7 heroes each.
- `drawHero` draws a player from primitives, with poses and outlines.
- Also: the court (`drawToonArena`), goals, ball, referees, power effects, `drawFlag` (national flags) and `drawCrest` (club shields).

**`tv.js`:**
- `TVCam` is a shifted-lens perspective camera. It looks down at about 40° and follows the ball along and across the court.
- `makeFloor()` builds the court texture.
- `renderTV()` draws the stands, LED boards and 3D goals. Each upright object is drawn through a `Proxy` renderer that scales the normal toon drawing to its distance. Heroes are drawn ×1.3.

**Top view:** `render()` in `main.js` draws the court flat from above. Upright objects are lifted by `Z2Y` (0.62).

## The app: `js/main.js`
**Modes:**
- `menu`: home, with the demo match behind.
- `pick`: the steps `team`, then `kids`.
- `play`, `paused`, `break` (half-time or full-time).

**Settings:**
- `settings` are saved in localStorage under `handball8`. The fields are `difficulty`, `half`, `rules`, `sound`, `music`, `view`, `team`, `players[]`, `opponent`, `oppKid` and `played`.
- Old `handball7` data is migrated once.
- `cleanSettings()` repairs anything stale.

**The flow:**
1. `syncHome()`: "שחקו שוב" once you have played, otherwise "יאללה, משחקים!".
2. `showPick('team')`: tabs ליגת הילדים and נבחרות; tapping a team card moves on.
3. `showPick('kids')`: toggle which kids play (at least one). The opponent chip re-rolls with `rollOpponent()`.
4. `newMatch()`:
   - draws the power kid and the power;
   - builds the line-up with `autoLineup()`: the kids first (LB, RB, PV, LW), then Hornets heroes;
   - stores everything in `setup`;
   - calls `startMatch()`, which creates the `Game`.
   - "מתחילים מחדש" and "עוד משחק!" reuse `setup`; "יריב חדש" re-rolls only the opponent.

**Opponents:** `opponentsOf(team)`:
- הצרעות always play הצפעונים;
- a club plays another club;
- a nation plays another nation.
- When shirts look alike, `matchKits()` gives the opponent an away kit.

**Back button:** `history.pushState` and `popstate` call `goBack()`, which goes back one screen, or pauses during a match.

**HUD:** the scoreboard, corner buttons (camera and pause), joystick and the POWER/pass/shoot buttons are DOM elements over the canvas. `updateHUD()` refreshes them.

**Zoom blocking:** `blockPageZoom()` stops iOS double-tap and pinch zoom, but still lets menu and corner buttons take quick repeated taps.

**Test hook:** `window.handball` exposes `game`, `mode`, `setup`, `input` and `replayWith(o)`.

## Input: `js/input.js`
Pointer Events with capture on the arrow pad (`#stick`) and the buttons (`#btnA` pass/switch, `#btnB` shoot/steal, `#btnP` power), plus the keyboard (WASD/arrows, J/K/L, P/Esc).

Robust release handling covers window-level `pointerup`/`pointercancel`, `lostpointercapture`, a `touchend` sweep, and `reset()` on screen changes and on window blur. The joystick must never stick; tests cover this.

## Sound: `js/audio.js`
`Sound` makes all audio with WebAudio, with no audio files: a music loop (kick, snare, hat, tones) through a limiter, plus `whistle`, `thud`, `crowd`, `zap`, `freeze`, `boom`, `fanfare` and `whoosh`.

`unlock()` runs on the first user gesture; iOS needs this.

## Offline and deploy
- `sw.js` is the service worker. Requests go to the network first, with the cache as a fallback (`no-cache` fetches). `CORE` lists the files to cache, so **add new files there**.
- `manifest.webmanifest` lets the game be installed to the home screen.
- `tools/stamp.mjs <sha>` runs only in CI. It versions every URL and the cache name, so phones never mix old and new files. It also sets `VERSION` in `main.js` and writes `version.txt`.
- **Self-update:** `checkVersion()` in `main.js` fetches `version.txt` every minute and when the page becomes visible. When it differs from `VERSION`, the game reloads as soon as it is on the home screen (`reloadIfNew()`, also called from `toMenu()`), never during a match.
- `.github/workflows/pages.yml` runs: `npm test` → stamp → GitHub Pages (on every push to `main`).

## Tests
**`npm test`** (Node, no browser):
- `tests/sim.mjs`: 3 AI matches must score and shoot.
- `tests/power.mjs`: every power fires, freezes, empties and refills the meter, arms, and scores.
- `tests/pass.mjs`: a "kid" wiggling the stick still lands ≥75% of passes.
- `tests/lineup.mjs`: line-ups apply, and no hero plays on both teams.

**`npm run e2e`** (Playwright, real touch through CDP) has these sections:
- `flow`: home → match in 3 taps, Hebrew text, fonts, music.
- `control`: the joystick never moves by itself and never sticks.
- `zoom`: double tap.
- `power`: every power through the real button.
- `rival`: the computer's close-up.
- `menus`: pause, rules, menu, and the upright-phone hint.
- `kids`: toggling kids, the opponent chip, the line-up.
- `teams`: nations, flags, shirts, "שחקו שוב", restart, the back button, settings, migration, wording.
- `view`: the camera button.
- `match`: a full match, half-time and full-time.

`tests/run-e2e.mjs` runs the sections in parallel.

## Mocks: `mock/`
Design sketches, not part of the game:
- `index.html`: the character sheet.
- `eitan.html`: one kid in every power.
- `fifa.html` and `fifa-b.html`: the camera-style options that led to the TV view.
