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
| View: top / TV camera / night | 🎥 (top corner) | menu |

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
js/tv.js            TV camera view (like FIFA): perspective court, stands, LED boards, 3D goals, night lighting
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

## Views

The 🎥 button (top corner, next to the music button) switches the view during a match. The choice is remembered and is also in the menu:
- **Top (מלמעלה):** the camera looks down on the court.
- **TV (טלוויזיה):** a high camera on the sideline, like a TV broadcast. The court has depth, and there are stands full of fans, LED boards and 3D goals. The heroes are drawn 30% bigger than life, so they stay easy to see.
- **Night (לילה):** the TV camera in a dark arena, with a spotlight that follows your player.

In the TV view the renderer draws the court as one texture in perspective (a full-screen WebGL pass, or row by row on Canvas 2D). The upright things are drawn by the usual toon code through a proxy that scales them for their distance.

## Heroes and powers

**Play** opens two steps:
1. Pick a team: Eitan's, Emma's or Eyal's team. The kid is drawn from a photo and plays centre back.
2. Pick a special power.

The match then starts. 40% of the time the computer's team is led by one of the other kids. Otherwise it is led by Venom. Either way, the computer's hero gets a random power and uses it near your goal.

| Power | Ball | What it does |
| --- | --- | --- |
| Lightning | glowing ball with small lightning bolts, electric trail | the keeper freezes, can't be blocked |
| Fire | fireball with a ribbon of flame | can't be blocked, keeper rarely saves |
| Muscle | yellow ball with shock-wave rings | shot twice as fast |
| Ice (Eyal's favourite) | ball with orbiting ice crystals, frosty trail | every rival is frozen in a block of ice for 3 s |
| Captain | white ball with stars circling it | the whole team runs 30% faster for 8 s |

**POWER button:** it starts full and refills in under 30 seconds. The computer's meter fills about 3x slower. Tapping POWER does one of two things:
- **Your team has the ball:** the match freezes for a full-screen close-up of your hero (big head, flexing muscles, in the power's costume). The ball is then powered for 10 seconds, in the hands of whoever has it.
- **The rivals have the ball:** the power is armed, and fires the moment your team gets the ball.

**Passes are magnetic:** the ball bends toward the teammate it was passed to, wherever they run, and your passes are hard for the computer to cut off.

**Your player always answers the joystick**, including at throw-offs and set pieces. The default rules are *Easy* (no 3-step or 3-second calls). *Real* is still in the menu.

**Where things live:**
- `js/heroes.js` has the kids' look profiles and the power templates. To add a kid from a photo, add a profile.
- `js/powers.js` runs the powers.
- `js/toon.js` draws everything cartoon.
- `mock/eitan.html` shows every power for a kid side by side.

## Tests

- `npm test`: headless matches (`tests/sim.mjs`), every power end to end (`tests/power.mjs`) and the pass magnet (`tests/pass.mjs`).
- `npm run e2e`: plays the real game in Chromium as a phone held sideways, using **real touch events**. It covers:
  - the pick flow, Hebrew labels and fonts, and the music level;
  - the joystick: never moves by itself, always stops on release, two thumbs, cancelled touches, a stale touch replaced by a new one;
  - double-tap zoom;
  - every power through the real POWER button, including armed powers;
  - the computer's power, menus and the upright-phone hint;
  - the view button (top, TV, night), steering in the TV view, and remembering the view;
  - a fast-forwarded full match.
  - `ONLY=control,power` runs some sections. `SERVE_DIR=…` tests a stamped build.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs `npm test`, stamps every JS/CSS URL with the commit (`tools/stamp.mjs`, so phones never mix old and new files from their cache), and publishes the site on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The game is then at `https://<user>.github.io/ai.games.handball/`.
