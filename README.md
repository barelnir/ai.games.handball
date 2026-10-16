# Handball Seven

A 2D handball game in plain HTML and JavaScript, drawn with **WebGL** and playable on a phone or a desktop browser. No build step and no libraries.

You play the **Hornets** (yellow) against the **Vipers** (red), 7 v 7 on a 40 × 20 m court with real IHF markings, two referees and a crowd.

## Play

- **On your phone:** open the GitHub Pages URL (see *Deploy*), turn the phone sideways, and tap **Throw-off**. Use *Add to Home Screen* to install it full-screen. It also works offline.
- **Locally:** `npm start` (or `python3 -m http.server 8080`), then open <http://localhost:8080>. ES modules need a web server, so opening `index.html` from disk won't work.

| Action | Phone | Keyboard |
| --- | --- | --- |
| Move | Left thumb anywhere (floating joystick) | WASD / arrows |
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
js/draw.js          Arena, court, goals, players, referees and ball, built from 4 primitives
js/input.js         Keyboard + multi-touch joystick and buttons
js/audio.js         Synthesised whistle, ball and crowd sounds (WebAudio)
js/powers.js        Special powers framework (disabled, ready for later)
sw.js, manifest     PWA: install to the home screen, works offline
tests/sim.mjs       Headless AI-vs-AI matches (`npm test`)
```

**Graphics:** every shape (ellipse, rounded rectangle, ring, capsule line) is one instance of a quad. A GLSL fragment shader shades it with an anti-aliased signed-distance function, so the whole frame is a single `drawArraysInstanced(…, 6, n)` call. Browsers without WebGL 2 automatically use the Canvas 2D renderer, which has the same API. The renderer in use is shown on the menu screen.

**Figures:** small upright "3/4 view" players drawn on a top-down court. Height (jumps, ball arcs) lifts things up the screen. Each player has a random skin tone, hair colour and hairstyle, animated legs and arms, and poses for shooting, stealing, blocking and goalkeeper dives.

## Special powers (next step)

`js/powers.js` is the extension slot. The game already asks it for a multiplier wherever a power could matter: `speed`, `shotSpeed`, `shotError`, `catchRadius`, `stealResist` and `gkReach`. Each team fills an energy meter (shown around the POWER button) from time, goals, saves and steals. To turn powers on:

1. add or edit entries in `POWERS` (four examples are there: Rocket Shot, Turbo Legs, Sticky Hands, Keeper Wall),
2. set `POWERS_ENABLED = true`,
3. optionally add visuals in `draw.js` by checking `player.effects`.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the simulation test and publishes the site on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The game is then at `https://<user>.github.io/ai.games.handball/`.
