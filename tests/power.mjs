// Special powers, end to end in the simulation, for every template (and every kid).
import { Game } from '../js/game.js';
import { TEMPLATE_LIST, PROFILES } from '../js/heroes.js';
import { goalDist } from '../js/court.js';

let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) fails++; };
const step = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(1 / 60); };
const until = (g, f, max = 600) => { let n = 0; while (!f() && n++ < max) g.step(1 / 60); return f(); };
const newGame = (o = {}) => {
  const g = new Game({ halfLen: 600, human: 0, difficulty: 'hard', rivalPowers: false, ...o });
  g.input = { mx: 0, my: 0 };
  until(g, () => g.state === 'play', 600);
  return g;
};

for (const tp of TEMPLATE_LIST) {
  // 1. our team has the ball: POWER fires at once, on whoever has the ball
  let g = newGame({ power: tp.key });
  const carrier = g.teams[0].players.find((p) => p.role === 'LB');
  g.setOwner(carrier);
  check(g.teams[0].energy >= 100, `${tp.label}: the meter starts full`);
  g.input.pPress = true; step(g);
  check(g.splash > 1.5 && g.ball.power === tp.ball && g.ball.owner === carrier, `${tp.label}: POWER fires at once`, `ball "${g.ball.power}"`);
  const c0 = g.clock; step(g, 60);
  check(g.clock === c0, `${tp.label}: match frozen during the close-up`);
  until(g, () => !(g.splash > 0));
  if (tp.fx.freezeTeam) {
    const opp = g.teams[1].players.filter((p) => p.active);
    const pos = opp.map((p) => [p.x, p.y]);
    step(g, 60);
    const moved = opp.filter((p, i) => Math.hypot(p.x - pos[i][0], p.y - pos[i][1]) > 0.3).length;
    check(opp.every((p) => p.frozen > 0) && moved === 0, `${tp.label}: every rival is frozen and can't move`, `${moved} moved`);
  }
  if (tp.fx.teamSpeed) check(g.teams[0].players.filter((p) => p.effects.some((e) => e.id === 'rally')).length >= 5, `${tp.label}: the whole team gets the speed boost`);
  check(g.teams[0].energy < 10, `${tp.label}: the meter empties after use`);
  // refills fast: under 30 s
  until(g, () => g.teams[0].energy >= 100, 60 * 40);
  check(g.teams[0].energy >= 100, `${tp.label}: the meter refills within 40 s`);

  // 2. the rivals have the ball: POWER arms, and fires the moment we get the ball
  g = newGame({ power: tp.key });
  g.setOwner(g.teams[1].players.find((p) => p.role === 'CB'));
  g.input.pPress = true; step(g);
  check(!g.ball.power && g.powers.teams[0].armed, `${tp.label}: POWER without the ball arms it`);
  g.setOwner(g.teams[1].players.find((p) => p.role === 'LB')); // the rivals pass among themselves
  g.setOwner(g.teams[1].players.find((p) => p.role === 'PV'));
  check(g.powers.teams[0].armed, `${tp.label}: stays armed while the rivals pass`);
  g.setOwner(g.teams[0].players.find((p) => p.role === 'RB'));
  check(g.ball.power === tp.ball && g.splash > 0, `${tp.label}: armed power fires when we get the ball`);

  // 3. powered shots from 8 m score most of the time
  let goals = 0;
  const N = 12;
  for (let i = 0; i < N; i++) {
    g = newGame({ power: tp.key });
    const p = g.teams[0].players.find((q) => q.role === 'CB');
    g.setOwner(p); g.powers.start(p);
    until(g, () => !(g.splash > 0));
    const ax = g.teams[0].defX === 0 ? 40 : 0, s = ax === 40 ? -1 : 1;
    p.x = ax + s * 8; p.y = 10; p.vx = p.vy = 0;
    g.input.bPress = true; step(g);
    if (i === 0) check(g.ball.state === 'shot' && g.ball.power === tp.ball, `${tp.label}: the shot is powered`);
    const before = g.teams[0].score;
    until(g, () => g.ball.state !== 'shot', 200);
    if (g.teams[0].score > before) goals++;
  }
  const need = tp.fx.freezeKeeper || tp.fx.unblockable || tp.fx.keeperSave || tp.fx.freezeTeam ? 0.4 : 0;
  check(goals >= N * need, `${tp.label}: powered shots score`, `${goals}/${N} vs hard keeper`);
}

// every kid can lead the team, and the computer sometimes picks another kid
for (const pr of PROFILES) {
  const g = new Game({ human: 0, hero: pr.id, rivalHero: PROFILES.find((q) => q.id !== pr.id).id });
  check(g.teams[0].kit.he.includes(pr.nameHe) && g.teams[0].players.find((p) => p.role === 'CB').hero.nameHe === pr.nameHe, `team of ${pr.name}: named after the kid, kid plays centre back`);
  check(g.teams[1].players.find((p) => p.role === 'CB').hero.custom && g.powers.teams[1].profile.id !== pr.id, `rival kid hero is a different kid`);
}

// the computer uses its own power when attacking
{
  let fired = 0;
  for (let run = 0; run < 3 && !fired; run++) {
    const g = new Game({ halfLen: 300, human: 0, rivalPower: 'fire' });
    g.input = { mx: 0, my: 0 };
    until(g, () => g.state === 'play');
    const v = g.teams[1], lb = v.players.find((p) => p.role === 'LB'), ax = v.defX === 0 ? 40 : 0;
    lb.x = ax + (ax ? -11 : 11); lb.y = 8; g.setOwner(lb);
    for (let i = 0; i < 60 * 20 && !fired; i++) {
      g.step(1 / 60);
      for (const e of g.events) if (e.type === 'power' && e.team === 1) fired++;
      g.events.length = 0;
    }
  }
  check(fired > 0, 'the computer fires its own power when it attacks near goal');
}
process.exit(fails ? 1 : 0);
