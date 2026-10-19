# כדוריד הגיבורים · Handball Seven

A cartoon handball game in plain HTML and JavaScript, drawn with **WebGL**, in Hebrew, and playable on a phone or a desktop browser. There is no build step and there are no libraries.

**Play:** https://barelnir.github.io/ai.games.handball/

> **New here? Start with [`HANDOVER.md`](HANDOVER.md)** (Hebrew).
> - [`CLAUDE.md`](CLAUDE.md): rules and commands for AI-assisted work.
> - [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the code fits together.
> - [`docs/HISTORY.md`](docs/HISTORY.md): what was asked for, and why things are the way they are.
> - [`docs/ROADMAP.md`](docs/ROADMAP.md): open tasks.

The game is 7 v 7 on a 40 × 20 m court with real IHF markings, two referees, a crowd and background music.
- **Players:** every player is a big-headed cartoon hero. Six of them are real kids (איתן, אמה, אייל, רפל, רוי, כהן), drawn from their photos. The photos themselves are not stored anywhere.
- **Teams:** you play as הצרעות, a club from the league, or a national team.
- **Powers:** one of your kids gets a special power each match.

## Play

- **On your phone:** open the GitHub Pages URL, turn the phone sideways, and tap **יאללה, משחקים!**. Use *Add to Home Screen* to install it full-screen. It also works offline.
- **Locally:** `npm start` (or `python3 -m http.server 8080`), then open <http://localhost:8080>. ES modules need a web server, so opening `index.html` from disk won't work.

| Action | Phone | Keyboard |
| --- | --- | --- |
| Move | Arrow pad, bottom-left (or drag anywhere on the left half) | WASD / arrows |
| Pass · switch player | PASS / SWITCH | J or Z |
| Jump shot · steal / block | Hold SHOOT and release · tap STEAL | Hold K or X · tap |
| Aim a shot | Push the stick up or down while winding up | W / S |
| Special power | כוח (when ready) | L |
| Pause | ❚❚ | P / Esc |
| Camera: top / TV | 🎥 (top corner) | |

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
js/clubs.js         League clubs and national teams: names, shirt colours, flags/emblems, away kits
js/tv.js            TV camera view (like FIFA): perspective court, stands, LED boards, 3D goals
js/input.js         Keyboard + multi-touch joystick and buttons
js/audio.js         Synthesised music loop, whistle, ball and crowd sounds (WebAudio, no audio files)
js/powers.js        Special power logic (driven by the chosen template)
js/heroes.js        Hero profiles (from photos), power templates, full-screen POWER portrait
sw.js, manifest     PWA: install to the home screen, works offline
tests/sim.mjs       Headless AI-vs-AI matches (`npm test`)
tests/power.mjs     Every power, end to end (`npm test`)
tests/pass.mjs      The pass magnet (`npm test`)
tests/lineup.mjs    Picking the players (`npm test`)
tests/e2e.mjs       Playwright phone test of the real game, in sections
tests/run-e2e.mjs   Runs the e2e sections in parallel (`npm run e2e`)
tools/stamp.mjs     Deploy-time versioning of every file URL
mock/               Design sketches (character sheet, powers, camera styles)
docs/               Architecture, history, roadmap
```

**Graphics:** every shape (ellipse, rounded rectangle, ring, capsule line, rounded triangle) is one instance of a quad. A GLSL fragment shader shades it with an anti-aliased signed-distance function, so the whole frame is a single `drawArraysInstanced(…, 6, n)` call. Browsers without WebGL 2 automatically use the Canvas 2D renderer, which has the same API. The renderer in use is shown on the menu screen.

**Heroes:** chibi-style players (head about half the height) with ink outlines, drawn upright on a top-down court. Each squad has 7 named heroes with their own hair, masks, capes, goggles and chest emblems, and poses for running, dribbling, jump shots, stealing, blocking and goalkeeper dives. `PACE` in `js/game.js` sets the overall game speed.

## Views

The 🎥 button (top corner, next to pause) switches the view during a match. The choice is remembered:
- **Top (מלמעלה):** the camera looks down on the court.
- **TV (טלוויזיה):** a camera on the near side looks down at about 40°, zoomed in like the top view, and follows the ball along and across the court. The court has depth, and there are stands full of fans, LED boards and 3D goals. The heroes are drawn 30% bigger than life, so they stay easy to see.

In the TV view the renderer draws the court as one texture in perspective (a full-screen WebGL pass, or row by row on Canvas 2D). The upright things are drawn by the usual toon code through a proxy that scales them for their distance.

## Heroes and powers

**The flow** (decided with a UX and a product review: as few taps as possible, one meaning per word, then simplified again by the parent: no captain and no power to pick):
- **Home:** "יאללה, משחקים!" the first time. After that, a big **"שחקו שוב"** card replays last time's match in one tap. There is also "משחק חדש", "⚙ הגדרות" (difficulty, half length, rules) and "איך משחקים".
- **"באיזו קבוצה משחקים?"** has two tabs:
  - **ליגת הילדים:** הצרעות first, then the clubs.
  - **נבחרות:** national teams, with their flags.
  - Clubs wear an emblem of our own: a shield in the club colours with its initials. It is not the official logo.
  - Tapping a team moves on.
- **"מי משחק ב…?"**:
  - **Which kids play:** the six kids from the photos (איתן, אמה, אייל, רפל, רוי, כהן). All six play at first. A kid new to the game joins a saved team once. One tap takes a kid out or puts them back, and at least one kid always plays. The Hornets' cartoon heroes fill the other places.
  - **Opponent:** the opponent chip shows who you play against. It comes from your group: club against club, nation against nation, and הצרעות always against הצפעונים. Tapping 🔀 draws another opponent. Sometimes a kid who isn't playing for you leads the opponent, and the chip says so.
  - **The power is drawn:** at kick-off one of your kids is drawn to carry the special power, the power itself is drawn too, and a message says who got what (for example "הכוח של אמה ❄ קרח").
- **Match:** the corner buttons are the camera (top or TV) and pause. On phones, fullscreen turns on by itself.
- **Pause:** ממשיכים, מתחילים מחדש (same match), music, sounds, fullscreen, איך משחקים, לתפריט.
- **End of match:** "עוד משחק!" (same match). "יריב חדש" re-draws only the opponent, but not for הצרעות.
- **Back button:** the phone's back button goes back one screen, and in a match it pauses.

Choices are saved under `handball8`. Older `handball7` data carries over once.

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
- `js/clubs.js` has the teams. Each club has an emblem of our own; each nation has its flag.

## Tests

- `npm test`: headless matches (`tests/sim.mjs`), every power end to end (`tests/power.mjs`), the pass magnet (`tests/pass.mjs`) and the line-up (`tests/lineup.mjs`).
- `npm run e2e`: plays the real game in Chromium as a phone held sideways, using **real touch events**. The sections run in parallel, each in its own browser (`tests/run-e2e.mjs`, about 2 minutes; `npm run e2e:serial` runs them one by one). It covers:
  - the flow (3 taps from opening to the match), Hebrew labels and fonts, the drawn power, and the music level;
  - the kids screen: taking kids out and back in (at least one), the opponent chip, and the match matching the chip;
  - teams: national teams, flags, different shirts, "שחקו שוב" in one tap, restart keeps the match, back button, settings, old saved data;
  - the joystick: never moves by itself, always stops on release, two thumbs, cancelled touches, a stale touch replaced by a new one;
  - double-tap zoom;
  - every power through the real POWER button, including armed powers;
  - the computer's power, menus and the upright-phone hint;
  - the view button (top, TV), quick taps, steering in the TV view, and remembering the view;
  - a full match (the simulation is fast-forwarded inside the page, then the real half-time and full-time screens).
  - `ONLY=control,power` runs some sections, `JOBS=2` sets how many browsers run at once, and `E2E_DPR=2` draws at phone sharpness (slower). `SERVE_DIR=…` tests a stamped build.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs `npm test`, stamps every JS/CSS URL with the commit (`tools/stamp.mjs`, so phones never mix old and new files from their cache), and publishes the site on every push to `main`. The stamp also writes the version into the game and into `version.txt`; the game checks it every minute and reloads itself on the home screen when a new version is out (never in a match), so nobody has to close and reopen the site. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The game is then at `https://<user>.github.io/ai.games.handball/`.
