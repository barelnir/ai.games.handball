// Two players on two phones: both teams are steered by a player, and the friend's phone draws the
// match from the host's snapshots. Run: npm test
import { Game } from '../js/game.js';
import { SQUADS } from '../js/toon.js';
import { PROFILES, kidHero } from '../js/heroes.js';

let failed = false;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== '' ? `  (${info})` : ''}`); if (!ok) failed = true; };
const kid = (id) => kidHero(PROFILES.find((p) => p.id === id));
// what main.js builds: the kids first, then the team's cartoon heroes
const lineupOf = (kids, squad) => {
  const out = {};
  kids.forEach((k, i) => { out[['LB', 'RB', 'PV', 'LW'][i]] = kid(k); });
  for (const h of SQUADS[squad].heroes) if (h.role !== 'CB' && !out[h.role]) out[h.role] = h;
  return out;
};
const opts = {
  human: 0, human2: 1, halfLen: 120, rules: 'full', difficulty: 'hard',
  hero: 'eitan', power: 'fire', lineup: lineupOf(['eyal'], 0),
  rivalHero: 'emma', rivalPower: 'ice', lineup2: lineupOf(['rafael'], 1),
};

// ---- the teams
{
  const g = new Game(opts);
  const names = g.teams.map((t) => t.players.map((p) => p.hero.name));
  check(names[0].includes('Eitan') && names[0].includes('Eyal'), 'host team: their kids', names[0].join(','));
  check(names[1].includes('Emma') && names[1].includes('Rafael'), 'friend team: their kids', names[1].join(','));
  check(!names[1].some((n) => names[0].includes(n)) && new Set(names[1]).size === 7, 'no hero on both teams');
  check(g.humans.join() === '0,1', 'both teams are steered by a player');
}

// ---- both sticks steer their own player
{
  const g = new Game(opts);
  g.inputs = [{ mx: 0, my: 0 }, { mx: 0, my: 0 }];
  for (let k = 0; k < 60 * 3; k++) g.step(1 / 60);
  const results = [];
  for (const [h, dir] of [[0, 1], [1, -1], [0, -1], [1, 1]]) {
    // wait until that player can move (not frozen, no close-up, ball in play)
    for (let k = 0; k < 600 && !(g.state === 'play' && g.ctrl[h] && !(g.ctrl[h].frozen > 0) && !(g.splash > 0)); k++) g.step(1 / 60);
    g.inputs[h].mx = dir; g.inputs[h].my = 0;
    for (let k = 0; k < 30; k++) g.step(1 / 60);
    const c = g.ctrl[h];
    results.push(c && Math.sign(c.vx) === dir && Math.abs(c.vx) > 1);
    g.inputs[h].mx = 0;
  }
  check(results.every(Boolean), 'each stick moves its own player, both ways', results.join(','));
}

// ---- a whole match with two players pressing buttons, and the friend's phone following it
{
  const host = new Game(opts);
  const guest = new Game(opts);
  guest.opts.human = 1; // the friend's phone shows team 1's player
  host.inputs = [{ mx: 0, my: 0 }, { mx: 0, my: 0 }];
  const steer = (h) => {
    const inp = host.inputs[h], c = host.ctrl[h], b = host.ball;
    if (!c) return;
    const goalX = host.teams[h].defX === 0 ? 40 : 0;
    const tx = b.owner === c ? goalX : b.x, ty = b.owner === c ? 10 : b.y;
    const d = Math.hypot(tx - c.x, ty - c.y) || 1;
    inp.mx = (tx - c.x) / d; inp.my = (ty - c.y) / d;
    if (b.owner === c) {
      c.__held = (c.__held || 0) + 1 / 60;
      if (Math.abs(goalX - c.x) < 10 && c.__held > 0.4) { if (!inp.bDown) { inp.bPress = true; inp.bDown = true; } else { inp.bDown = false; inp.bRelease = true; c.__held = 0; } }
      else if (c.__held > 1.6) { inp.aPress = true; c.__held = 0; }
    } else if (Math.random() < 0.02) inp.bPress = true;
    if (Math.random() < 0.003) inp.pPress = true;
  };
  let steps = 0, worst = 0, size = 0, owners = 0, ctrlOk = 0, snaps = 0;
  const counts = {};
  while (host.state !== 'fulltime' && steps < 60 * 400) {
    if (host.state === 'halftime') host.startSecondHalf();
    steer(0); steer(1);
    host.step(1 / 60); steps++;
    for (const e of host.events) counts[e.type + e.team] = (counts[e.type + e.team] || 0) + 1;
    host.events.length = 0;
    if (steps % 2) { guest.coast(1 / 60); continue; }
    const json = JSON.stringify(host.snapshot());
    size = Math.max(size, json.length);
    guest.applySnapshot(JSON.parse(json));
    snaps++;
    for (let i = 0; i < host.all.length; i++) worst = Math.max(worst, Math.hypot(host.all[i].x - guest.all[i].x, host.all[i].y - guest.all[i].y));
    if ((host.ball.owner && host.ball.owner.id) === (guest.ball.owner && guest.ball.owner.id)) owners++;
    if ((guest.controlled && guest.controlled.id) === (host.ctrl[1] && host.ctrl[1].id)) ctrlOk++;
    for (const p of guest.all) if (!Number.isFinite(p.x + p.y)) throw new Error('guest position became NaN');
  }
  guest.applySnapshot(JSON.parse(JSON.stringify(host.snapshot()))); // the last one, at the final whistle
  check(host.state === 'fulltime', 'a two-player match plays to the end', `${host.teams[0].score}-${host.teams[1].score}`);
  check((counts.shot0 || 0) > 2 && (counts.shot1 || 0) > 2, 'both players shoot', `${counts.shot0 || 0} / ${counts.shot1 || 0}`);
  check((counts.pass0 || 0) > 2 && (counts.pass1 || 0) > 2, 'both players pass', `${counts.pass0 || 0} / ${counts.pass1 || 0}`);
  check(host.teams[0].score + host.teams[1].score >= 1, 'goals are scored');
  check(worst < 0.01, 'the friend\'s phone shows every player where the host has them', worst.toFixed(4));
  check(owners === snaps && ctrlOk === snaps, 'same ball carrier, and the friend sees their own player marked');
  check(guest.teams[0].score === host.teams[0].score && guest.teams[1].score === host.teams[1].score && guest.state === host.state, 'same score and state');
  check(size < 4000, 'a snapshot is small', `${size} bytes`);
}

// ---- powers: the friend's meter fills as fast as the host's, and ice only holds a player 1.5 s
{
  const g = new Game(opts);
  g.teams[0].energy = g.teams[1].energy = 0;
  for (let k = 0; k < 60 * 5; k++) g.step(1 / 60);
  check(Math.abs(g.teams[0].energy - g.teams[1].energy) < 0.5 && g.teams[1].energy > 10, 'both meters fill at the same speed', `${g.teams[0].energy.toFixed(1)} / ${g.teams[1].energy.toFixed(1)}`);
  const carrier = g.teams[1].players.find((p) => p.role === 'CB');
  g.teams[1].energy = 100; g.powers.start(carrier);
  const frozen = g.teams[0].players.filter((p) => p.frozen > 0).map((p) => p.frozen);
  check(frozen.length > 0 && Math.max(...frozen) <= 1.5, 'the friend\'s ice holds the host\'s team 1.5 s at most');
}

// ---- one player is unchanged
{
  const g = new Game({ human: 0, hero: 'eitan', power: 'fire' });
  check(g.humans.join() === '0' && g.opts.human2 === undefined, 'one player: only your team is steered');
}
process.exit(failed ? 1 : 0);
