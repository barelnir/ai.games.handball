# Handball Seven

A 2D handball game in plain HTML and JavaScript, drawn with **WebGL** and playable on a phone or a desktop browser. No build step and no libraries.

You play the **Hornets** (yellow) against the **Vipers** (red), 7 v 7 on a 40 × 20 m court with real IHF markings, two referees, a crowd and background music. Every player is a big-headed cartoon hero with their own look (see `mock/` for the character sheet).

## Play

- **On your phone:** open the GitHub Pages URL (see *Deploy*), turn the phone sideways, and tap **Throw-off**. Use *Add to Home Screen* to install it full-screen. It also works offline.
- **Locally:** `npm start` (or `python3 -m http.server 8080`), then open <http://localhost:8080>. ES modules need a web server, so opening `index.html` from disk won't work.

| Action | Phone | Keyboard |
| --- | --- | --- |
| Move | Arrow pad, bottom-left (or drag anywhere on the left half) | WASD / arrows |
| Pass · switch player | PASS / SWITCH | J or Z |
| Jump shot · steal / block | Hold SHOOT and release · tap STEAL | Hold K or X · tap |
| Aim a shot | Push the stick up or down while winding up | W / S |
| Special power | POWER (slot reserved) | L |
| Pause | ❚❚ | P / Esc |

## Rules that are simulated

Full IHF mode (Arcade mode switches off the strict ones):

- **Goal area (6 m):** only the goalkeeper may stand in it. Court players are kept out, but a jump shot can fly in before landing.
- **3 steps / 3 seconds:** once you stop dribbling you have 3 steps and 3 seconds. The dots above your player count both down. Breaking either is a free throw for the other team. Double dribble is not allowed.
- **Fouls:** stealing from the front is fair. Tackles from behind are usually fouls. A foul gives a free throw, moved back to the 9 m line if it happened inside it. A foul that destroys a clear chance gives a **7-metre throw**.
- **Progressive punishment:** yellow card, then **2-minute suspensions** (the team plays one short; the time is scaled to the half length). A third suspension is a **red card**.
- **Passive play:** after about 25 s of attack the referee warns, and the attack has 4 passes left before it must shoot.
- **Restarts:** throw-off after goals, throw-ins, goalkeeper throws, corner throw-ins (when a defender last touched the ball), and switching ends at half-time.
- **Goalkeeper:** reacts to shots, dives, saves or parries, and starts counter-attacks.

## How it is built

```
index.html          UI shell: HUD, touch controls, menus, rules screen
css/style.css       Styling
js/main.js          Boot, game loop (fixed 60 Hz), camera, HUD, menus
js/game.js          The match: players, ball physics, rules, referees, AI (no DOM; runs in Node too)
js/court.js         Court geometry in metres (goal area "D", 9 m line, 7 m mark…)
js/render.js        Renderer: WebGL 2 (instanced SDF shapes, one draw call) with a Canvas 2D fallback
js/toon.js          Cartoon art: hero squads, court, goals, referees, ball (built from 5 primitives)
js/input.js         Keyboard + multi-touch joystick and buttons
js/audio.js         Synthesised music loop, whistle, ball and crowd sounds (WebAudio, no audio files)
mock/index.html     Character sheet / look-and-feel mock
js/powers.js        Special power logic (driven by the chosen template)
js/heroes.js        Hero profiles (from photos), power templates, full-screen POWER portrait
sw.js, manifest     PWA: install to the home screen, works offline
tests/sim.mjs       Headless AI-vs-AI matches (`npm test`)
tests/power.mjs     Eitan's power, end to end (`npm test`)
tests/e2e.mjs       Playwright phone test of the real game (`npm run e2e`)
```

**Graphics:** every shape (ellipse, rounded rectangle, ring, capsule line, rounded triangle) is one instance of a quad. A GLSL fragment shader shades it with an anti-aliased signed-distance function, so the whole frame is a single `drawArraysInstanced(…, 6, n)` call. Browsers without WebGL 2 automatically use the Canvas 2D renderer, which has the same API. The renderer in use is shown on the menu screen.

**Heroes:** chibi-style players (head about half the height) with ink outlines, drawn upright on a top-down court. Each squad has 7 named heroes with their own hair, masks, capes, goggles and chest emblems, and poses for running, dribbling, jump shots, stealing, blocking and goalkeeper dives. `PACE` in `js/game.js` sets the overall game speed.

## Your hero and power templates

On the menu, **Your hero** picks the player and a **power template**. A hero is a cartoon made from a photo, for example Eitan. The hero plays centre back for the Hornets.

| Template | Ball | What the power does |
| --- | --- | --- |
| Lightning | glowing ball with small lightning bolts, electric trail | the keeper freezes, can't be blocked |
| Fire | fireball with a ribbon of flame | can't be blocked, keeper rarely saves |
| Muscle | yellow ball with shock-wave rings, speed lines | shot twice as fast |
| Captain | white ball with stars circling it | the whole team runs 30% faster for 8 s |

How it plays: the POWER button fills up over time and with goals, saves and steals, and glows **READY** when full.
1. Press POWER. If a team-mate has the ball, they pass it to your hero.
2. The match freezes for a full-screen close-up: big head, glasses, flexing muscles, in the template's costume.
3. For 10 seconds the ball is powered. A powered shot uses the template's effect.

Where things live:
- `js/heroes.js` has the **profiles**, one per player: skin, hair, hairstyle, eyes, glasses. It also has the **templates**: costume, ball type, glow colour, sound and `fx`. **To add a player from a new photo, add one profile.**
- `js/powers.js` runs the power.
- `js/toon.js` draws the balls, trails and glows.
- `mock/eitan.html` shows every template for a hero side by side.
- `npm test` checks every template end to end (`tests/power.mjs`).

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the simulation test and publishes the site on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The game is then at `https://<user>.github.io/ai.games.handball/`.
