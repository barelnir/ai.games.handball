# CLAUDE.md: working on "כדוריד הגיבורים" (Handball Seven)

A cartoon handball game for a family's kids.
- **Platform:** phones held sideways and desktop.
- **Language:** Hebrew UI, right to left.
- **Code:** plain HTML and ES modules drawn with WebGL 2, with a Canvas 2D fallback. There are no dependencies and no build step.
- **Deploy:** GitHub Pages, from `main`.

The owner is handing the project to **Eitan Barel** (one of the kids in the game); start him at `HANDOVER.md`. The user often writes in Hebrew, so answer in Hebrew.

## Commands
- **Run locally:** `npm start`, then open http://localhost:8080. The game needs a server; `file://` will not load ES modules.
- **Fast tests:** `npm test`, about 4 s.
  - `tests/sim.mjs`: AI-vs-AI matches.
  - `tests/power.mjs`: every power.
  - `tests/pass.mjs`: the pass magnet.
  - `tests/lineup.mjs`: line-ups and no duplicate heroes.
  - `tests/twoplayer.mjs`: two players, and the friend's phone following the host's snapshots.
- **Browser tests:** `npm run e2e`, about 2 min.
  - The real game runs in headless Chromium as an 844×390 phone, with real CDP touch events.
  - The 11 sections run in parallel, 3 at a time, through `tests/run-e2e.mjs`.
  - The `two` section opens two phones in one browser context. They meet over a `BroadcastChannel` (`?signal=bc`) and play over real WebRTC.
  - `ONLY=flow,kids` runs some sections, and `JOBS=n` sets the parallelism.
  - `E2E_DPR=2` gives sharper screenshots but runs slower.
  - Screenshots go to `test-results/`, which is git-ignored. Look at them after UI changes.
- **Serial run:** `npm run e2e:serial` runs one process, which is easier to debug.
- **Playwright:** in the cloud container it is at `/opt/node-tools/node_modules/playwright`, and Chromium is at `/opt/pw-browsers/chromium-1194/...`. `tests/e2e.mjs` finds both.

## Rules
1. **Test before every push to `main`.** Run `npm test` and `npm run e2e`. Never push red. Pushing to `main` deploys the site: the `.github/workflows/pages.yml` workflow runs `npm test`, then `tools/stamp.mjs <sha>`, then Pages.
2. **Work on a branch.** Use `claude/handball-game` or another branch, then fast-forward `main`. Don't create PRs unless asked.
3. **The kids' photos are never stored in the repo or the game.** Kids are drawn from parameters in `js/heroes.js` `PROFILES`.
4. **Hebrew in the UI.**
   - Hebrew only; an e2e check fails on Latin letters in the in-game labels.
   - The word "נבחרת" is used only for national teams. The text "הנבחרת של" must not appear anywhere; the e2e test checks this.
   - The kid is spelled **רפל**, not "רפאל".
5. **Keep the flow simple.** It was decided with a UX/PM review and the parent; see `docs/HISTORY.md`. The flow is: home → team → which kids play → match, which is 3 taps. The power kid and the power are drawn at kick-off. Don't bring back the captain picker, the power picker or the position editor without being asked.
   - Two players: home → "👫 שני שחקנים" → team → kids → "פותחים משחק" (shows a code) or "מצטרפים למשחק" (type the code).
6. **Official club logos are not bundled.** Club emblems are our own shields (`drawCrest` in `js/toon.js`); national teams wear their flags (`drawFlag`). See `docs/ROADMAP.md` for adding real logos.
7. **Explain to the user in Hebrew** what changed, how it was tested, and what they need to do: close and reopen the site.

## Architecture in one breath
- **`js/main.js`:**
  - Owns the DOM, the fixed-step loop (60 Hz) and the cameras: the top view, or the TV view in `js/tv.js`.
  - Owns the menus and the saved settings. These are saved in localStorage under `handball8`; `handball7` is migrated once.
  - The test hook is `window.handball`: `game`, `mode`, `setup`, `input`, and `replayWith({...})`.
- **`js/game.js`:** `new Game(opts)` is the whole match, with no DOM, and also runs in Node. Its options are:
  - `human`: 0, or -1 for a demo match. `human2: 1` makes team 1 a second player too (two phones).
  - Per team: `inputs[t]`, `ctrl[t]` (the steered player) and `hints[t]`. `input`, `controlled` and `passHint` are getters for this phone's team (`human`).
  - `halfLen`, `difficulty`, and `rules` (`'arcade'` or `'full'`).
  - `hero` and `power`: the power kid's id and the template key.
  - `rivalHero` and `rivalPower`.
  - `rivalPowers: false` disables the computer's powers.
  - `lineup`: role → hero.
  - `kits`: from `matchKits`.
- **Drawing:**
  - `js/render.js` draws 5 SDF primitives, all instanced in one draw call: ellipse, rect, ring, line and tri. It also draws a perspective floor pass for the TV view.
  - `js/toon.js` and `js/heroes.js` draw everything from those primitives.
- **Two phones:** `js/net.js` links them (WebRTC, found through the PeerJS server). The host's phone runs the match. The friend's phone sends its input and draws `Game.snapshot()`s with `applySnapshot()`; it never steps its copy. All the two-player wiring in `js/main.js` is under "two players, two phones"; `net` is null with one player.
- **Data:**
  - `js/clubs.js`: teams, kits, away kits, and opponent groups.
  - `js/heroes.js`: kid profiles and power templates.
  - `js/powers.js`: power logic.

More detail is in `docs/ARCHITECTURE.md`.

## Gotchas
- **`pkill -f "something"` from a Bash tool can kill your own shell** when the pattern appears in the command line, such as `ONLY=match`. Use `TaskStop`, or find PIDs first.
- **Two e2e runs at once compete for 4 CPUs** and become flaky. Run one at a time.
- **The headless renderer is slow, about 5–10 fps.** Tests wait on *game time* (`waitGame`) or on states, not on wall time.
- **Waiting for a full match:** fast-forward the simulation in the page (`game.step` in a loop) instead of letting the render loop run; see the `match` section.
- **The computer's ice power can freeze your player for 1.5 s.** Tests that steer wait until `!(controlled.frozen > 0)` and `!(splash > 0)`.
- **The service-worker cache name and every JS/CSS URL are stamped at deploy time.** Add new JS files to `sw.js` `CORE`, which is the offline list.
- **Corner buttons need quick repeated taps to register.** The double-tap-zoom blocker in `blockPageZoom()` skips `.corner button`, `.seg` and the menu buttons; keep it that way.
- **Two players can't be tried against the public PeerJS server from the cloud container** (it is blocked). The e2e test uses `?signal=bc`. To test the real protocol, run the `peer` npm package on 127.0.0.1 (the container has no IPv6) and run `PEER=127.0.0.1:9000 ONLY=two npm run e2e`.
- **Most of the internet is blocked in the cloud container,** including Wikipedia, Google and handball.org.il. `WebSearch` works. To fetch images, the user must add hosts in the environment's network settings.

## The Claude artifact copy
There is also a copy at https://claude.ai/artifact/CNfPWPxf4KNy9816Rdi5vS. It is made from `index.html`:
- the `<body>` is wrapped in `<div dir="rtl" lang="he">`;
- the head links are kept, without the manifest or service worker;
- all `css/` and `js/` files are added as artifact `files`.

The family should use the GitHub Pages site, because zoom can't be blocked inside the Claude app.
