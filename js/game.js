// Handball match simulation: players, ball physics, rules, referees and AI.
// Pure logic, no DOM – rendering and input live elsewhere, so this file also runs in Node for tests.

import {
  W, H, CX, CY, POST_LO, POST_HI, GOAL_H, PEN_D,
  clamp, lerp, goalDist, pushOut, dPoint, dParam, distToSegment,
} from './court.js';
import { PowerSystem } from './powers.js';
import { SQUADS } from './toon.js';
import { TEMPLATES, profileById, heroFromProfile } from './heroes.js';

const G = 9.8;
const ROLES = ['GK', 'LW', 'LB', 'CB', 'RB', 'RW', 'PV'];
const NUMBERS = [[1, 5, 9, 7, 11, 3, 14], [12, 6, 10, 8, 4, 2, 17]];

// Attack shape: [metres out from the goal line, lateral offset (negative = attacker's left)].
const ATTACK = { LW: [1.4, -8.0], LB: [9.6, -5.2], CB: [10.4, 0], RB: [9.6, 5.2], RW: [1.4, 8.0], PV: [6.4, 0] };
// 6-0 zone defence: position along the 6-metre "D" (0 = one corner, 1 = the other).
const DEF_T = { LW: 0.05, LB: 0.25, CB: 0.42, PV: 0.58, RB: 0.75, RW: 0.95 };

export const DIFFICULTY = {
  easy:   { speed: 0.86, steal: 0.35, gk: 0.30, react: 0.25, aim: 1.35, think: 0.30, intercept: 0.22 },
  normal: { speed: 0.96, steal: 0.60, gk: 0.42, react: 0.17, aim: 1.00, think: 0.20, intercept: 0.38 },
  hard:   { speed: 1.03, steal: 0.95, gk: 0.52, react: 0.12, aim: 0.80, think: 0.13, intercept: 0.52 },
};

// he: team name, to: "to the team" (e.g. free throw to the Vipers), short: scoreboard label
export const KITS = SQUADS.map((sq) => ({ name: sq.name, he: sq.he, to: sq.to, abbr: sq.short, ...sq.kit }));
const heName = (p) => p.hero.nameHe || p.hero.name;

// Overall pace. Lower = calmer game (player speed, passes and shots all scale with it).
const PACE = 0.72;


const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
const hyp = Math.hypot;

const VIOLATIONS = {
  steps: 'יותר מדי צעדים',
  three: 'החזקה ארוכה מדי',
  passive: 'משחק פסיבי',
};

function makePlayer(team, role, i) {
  return {
    id: team * 10 + i, team, role, gk: role === 'GK', num: NUMBERS[team][i],
    hero: SQUADS[team].heroes.find((h) => h.role === role),
    x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, air: false, landT: 9,
    face: team === 0 ? 0 : Math.PI, phase: Math.random() * 6,
    carry: null, holdT: 0, stepDist: 0, stillT: 0, ballT: 0, slowT: 0, charge: 0, charging: false,
    action: null, actT: 0, stance: 0, stealCd: 0, diveDir: 0,
    fouls: 0, yellow: false, susp: 0, suspCount: 0, red: false, active: true,
    effects: [],
    ai: { think: 0, holdLimit: 1.5, cutT: rnd(2, 6), cut: 0, delay: 0 },
  };
}

export class Game {
  constructor(opts = {}) {
    this.opts = Object.assign({ halfLen: 300, difficulty: 'normal', rules: 'full', human: 0 }, opts);
    this.diffAI = DIFFICULTY[this.opts.difficulty] || DIFFICULTY.normal;
    this.events = [];
    this.input = {};
    this.powers = new PowerSystem(this);
    this.teams = [0, 1].map((i) => ({
      idx: i, kit: KITS[i], score: 0, defX: i === 0 ? 0 : W, energy: 60,
      players: ROLES.map((r, j) => makePlayer(i, r, j)),
      stats: { shots: 0, goals: 0, saves: 0, steals: 0, fouls: 0, turnovers: 0, suspensions: 0 },
    }));
    this.all = [...this.teams[0].players, ...this.teams[1].players];
    // the player's own hero (from a photo) plays centre back, with the chosen power template
    const h = this.opts.human;
    if (h >= 0) {
      this.profile = profileById(this.opts.hero);
      this.template = TEMPLATES[this.opts.power] || TEMPLATES.lightning;
      const cb = this.teams[h].players.find((p) => p.role === 'CB');
      cb.hero = heroFromProfile(this.profile, this.template);
      this.powers.configure(this.template, this.profile.nameHe);
    }
    this.ball = {
      x: CX, y: CY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, state: 'dead', passTo: null, tx: 0, ty: 0,
      shooter: null, goalX: 0, shotDist: 0, age: 0, last: null, lastTeam: 0, ignore: null,
      tried: new Set(), checkedGK: false, bounce: 0,
    };
    this.refs = [
      { x: 16, y: -0.8, vx: 0, vy: 0, face: 0, phase: 0 },
      { x: 38, y: -0.8, vx: 0, vy: 0, face: 0, phase: 1 },
    ];
    this.half = 1; this.clock = 0; this.time = 0;
    this.poss = 0; this.attackT = 0; this.passive = false; this.passivePasses = 0;
    this.passiveTime = 25;
    this.suspLen = Math.max(20, (120 * this.opts.halfLen) / 1800);
    this.controlled = null; this.passHint = null;
    this.msg = null; this.signal = null; this.lock = null; this.sp = null; this.timer = 0;
    this.chaser = [null, null]; this.presser = [null, null];
    this.firstThrow = Math.random() < 0.5 ? 0 : 1;
    this.placeAll(this.firstThrow);
    this.setPiece('throwoff', this.firstThrow, CX, CY, {});
  }

  get full() { return this.opts.rules === 'full'; }
  emit(e) { this.events.push(e); }
  say(title, sub = '', t = 1.6, kind = 'info') { this.msg = { title, sub, t, kind }; }
  attackX(t) { return t.defX === 0 ? W : 0; }
  dir(t) { return t.defX === 0 ? 1 : -1; }
  diffFor(p) {
    if (this.opts.human < 0 || p.team !== this.opts.human) return this.diffAI;
    return DIFFICULTY.normal;
  }
  teamOf(p) { return this.teams[p.team]; }
  keeper(t) { return t.players.find((p) => p.gk && p.active); }
  opponents(p) { return this.teams[1 - p.team].players.filter((o) => o.active); }
  mates(p) { return this.teams[p.team].players.filter((o) => o.active && o !== p); }
  nearest(team, x, y, fieldOnly = true, except = null) {
    let best = null, bd = 1e9;
    for (const p of team.players) {
      if (!p.active || p === except || (fieldOnly && p.gk)) continue;
      const d = hyp(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  nearestOppDist(p) {
    let bd = 99;
    for (const o of this.opponents(p)) if (!o.gk) bd = Math.min(bd, hyp(o.x - p.x, o.y - p.y));
    return bd;
  }

  // ---------------------------------------------------------------- main step
  step(dt) {
    const inp = this.input || {};
    this.time += dt;
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if (this.signal && (this.signal.t -= dt) <= 0) this.signal = null;
    if (this.state === 'halftime' || this.state === 'fulltime') { this.clearEdges(); return; }
    // the POWER close-up freezes the match for a moment
    if (this.splash > 0) { this.splash -= dt; this.clearEdges(); return; }

    this.clock += dt;
    if (this.clock >= this.opts.halfLen) { this.endHalf(); this.clearEdges(); return; }
    this.powers.update(dt);
    this.updateSuspensions(dt);

    if (this.state === 'goal') {
      this.timer -= dt;
      if (this.timer <= 0) this.setPiece('throwoff', this.concede, CX, CY);
    } else if (this.state === 'setpiece') {
      this.sp.t += dt;
      if (this.sp.t >= this.sp.setup) {
        this.state = 'play';
        this.sp.taker.holdT = 0;
        this.emit({ type: 'whistle', n: 1, short: true });
      }
    }

    this.updateControl(inp);
    if (this.state === 'play') this.updateHuman(inp, dt);
    this.updatePlayers(dt, inp);
    this.updateBall(dt);
    if (this.state === 'play') this.updateRules(dt);
    this.updateRefs(dt);
    this.clearEdges();
  }

  clearEdges() {
    const i = this.input;
    if (!i) return;
    i.aPress = i.bPress = i.bRelease = i.pPress = false;
  }

  // ---------------------------------------------------------------- human control
  updateControl(inp) {
    const h = this.opts.human;
    this.passHint = null;
    if (h < 0) { this.controlled = null; return; }
    const team = this.teams[h], b = this.ball;
    let c = this.controlled;
    if (c && !c.active) c = null;
    if (b.owner && b.owner.team === h) c = b.owner;
    else if (b.state === 'pass' && b.passTo && b.passTo.team === h) c = b.passTo;
    else {
      if (!c || c.gk) c = this.nearest(team, b.x, b.y);
      if (b.state === 'loose' && c) {
        const n = this.nearest(team, b.x, b.y);
        if (n && hyp(n.x - b.x, n.y - b.y) + 1.5 < hyp(c.x - b.x, c.y - b.y)) c = n;
      }
      if (inp.aPress && this.state === 'play' && !(b.owner && b.owner.team === h)) {
        const n = this.nearest(team, b.x, b.y, true, c);
        if (n) c = n;
      }
    }
    this.controlled = c;
    if (c && b.owner === c) this.passHint = this.pickPassTarget(c, inp.mx || 0, inp.my || 0);
  }

  updateHuman(inp, dt) {
    const c = this.controlled, b = this.ball;
    if (inp.pPress) {
      const r = this.powers.activate(this.opts.human);
      const pct = Math.floor(this.teams[this.opts.human].energy);
      if (r === 'energy') this.say('הכוח נטען', `${pct}%`, 1.2, 'soft');
      else if (r === 'ball') this.say('קודם להשיג את הכדור!', '', 1.2, 'soft');
      else if (r === 'missing') this.say(`${this.profile.nameHe} לא על המגרש`, '', 1.2, 'soft');
    }
    if (!c) return;
    if (b.owner === c) {
      if (inp.aPress) {
        const t = this.pickPassTarget(c, inp.mx || 0, inp.my || 0);
        if (t) { this.pass(c, t); return; }
      }
      if (c.gk) {
        if (inp.bPress) { const t = this.bestPass(c, true); if (t) this.pass(c, t); }
        return;
      }
      if (inp.bPress) c.charging = true;
      if (c.charging) {
        if (inp.bDown) c.charge = Math.min(1, c.charge + dt / 0.8);
        if (inp.bRelease || !inp.bDown) {
          const my = inp.my || 0;
          this.shoot(c, Math.abs(my) > 0.25 ? my : null, Math.max(0.2, c.charge));
          c.charging = false; c.charge = 0;
        }
      }
    } else {
      c.charging = false; c.charge = 0;
      if (inp.bPress) this.tackle(c);
    }
  }

  pickPassTarget(p, mx, my) {
    const ml = hyp(mx, my);
    const dx = ml > 0.3 ? mx / ml : Math.cos(p.face), dy = ml > 0.3 ? my / ml : Math.sin(p.face);
    let best = null, bs = -1e9;
    for (const m of this.mates(p)) {
      if (m.gk) continue;
      const vx = m.x - p.x, vy = m.y - p.y, d = hyp(vx, vy) || 1;
      const cos = (vx * dx + vy * dy) / d;
      const s = cos * 3 - d * 0.07 + Math.min(this.nearestOppDist(m), 3) * 0.25;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  // ---------------------------------------------------------------- players
  updatePlayers(dt, inp) {
    const b = this.ball;
    this.computeRoles();
    for (const p of this.all) {
      if (!p.active) { this.benchPose(p, dt); continue; }
      p.frozen = (p.frozen || 0) - dt;
      p.stealCd -= dt; p.actT += dt; p.stance -= dt; p.slowT -= dt; p.landT += dt;
      if (p.action && p.actT > (p.action === 'dive' ? 0.7 : 0.45)) p.action = null;

      let want = null;
      if (b.owner === p && p !== this.controlled) this.aiCarrier(p, dt);
      const locked = this.lock && this.lock.p === p;
      if (this.state === 'setpiece' || this.state === 'goal') {
        if (locked || (this.state === 'setpiece' && p === this.sp.taker)) want = [0, 0, 0];
        else want = this.toward(p, this.setupTarget(p), this.state === 'goal' ? 0.55 : 1, 1.6);
      } else if (locked) {
        want = [0, 0, 0];
      } else if (this.lock && this.lock.penalty && !(p.gk && p.team !== this.lock.p.team)) {
        want = [0, 0, 0];
      } else if (p === this.controlled) {
        const mx = inp.mx || 0, my = inp.my || 0;
        const l = hyp(mx, my);
        want = l > 1 ? [mx / l, my / l, 1] : [mx, my, 1];
      } else {
        if (b.owner !== p && b.owner && b.owner.team !== p.team && !p.gk) this.aiDefendAction(p, dt);
        want = this.toward(p, this.aiTarget(p), 1, 1);
      }
      this.applyWant(p, want[0], want[1], dt, want[2]);
    }

    for (const p of this.all) {
      if (!p.active) continue;
      if (p.air) {
        p.z += p.vz * dt; p.vz -= G * dt;
        if (p.z <= 0) { p.z = 0; p.air = false; p.landT = 0; p.vx *= 0.4; p.vy *= 0.4; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const sp = hyp(p.vx, p.vy);
      p.phase += sp * dt * 3.1;
      let tf;
      if (sp > 0.45) tf = Math.atan2(p.vy, p.vx);
      else if (b.owner === p && !p.gk) tf = Math.atan2(CY - p.y, this.attackX(this.teamOf(p)) - p.x);
      else tf = Math.atan2(b.y - p.y, b.x - p.x);
      let da = tf - p.face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      p.face += clamp(da, -12 * dt, 12 * dt);
    }
    this.collide();
    this.constrain(dt);
  }

  toward(p, t, scale = 1, boost = 1) {
    const dx = t.x - p.x, dy = t.y - p.y, d = hyp(dx, dy);
    if (d < 0.08) return [0, 0, boost];
    const f = Math.min(1, d / 0.9) * (t.s == null ? 1 : t.s) * scale;
    return [(dx / d) * f, (dy / d) * f, boost];
  }

  maxSpeed(p) {
    let v = (p.gk ? 5.2 : 6.2) * PACE;
    if (this.ball.owner === p) v *= 0.88;
    if (p.charging) v *= 0.7;
    if (p.slowT > 0) v *= 0.5;
    v *= this.diffFor(p).speed * this.powers.mod(p, 'speed');
    return v;
  }

  applyWant(p, wx, wy, dt, boost) {
    if (p.air) return;
    const max = this.maxSpeed(p) * boost;
    const dvx = wx * max - p.vx, dvy = wy * max - p.vy;
    const dl = hyp(dvx, dvy), acc = 20 * dt * boost;
    const k = dl > acc ? acc / dl : 1;
    p.vx += dvx * k; p.vy += dvy * k;
  }

  collide() {
    const ps = this.all;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (!a.active) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const c = ps[j];
        if (!c.active) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = hyp(dx, dy);
        if (d < 0.56 && d > 1e-5) {
          const o = (0.56 - d) / 2, ux = dx / d, uy = dy / d;
          a.x -= ux * o; a.y -= uy * o; c.x += ux * o; c.y += uy * o;
        }
      }
    }
  }

  constrain(dt) {
    for (const p of this.all) {
      if (!p.active) continue;
      if (p.gk) {
        const gx = this.teamOf(p).defX, s = this.dir(this.teamOf(p));
        const cy = clamp(p.y, POST_LO, POST_HI);
        const dx = p.x - gx, dy = p.y - cy, d = hyp(dx, dy);
        if (d > 5.7) { p.x = gx + (dx / d) * 5.7; p.y = cy + (dy / d) * 5.7; }
        if (s * (p.x - gx) < 0.25) p.x = gx + s * 0.25;
      } else if (!p.air) {
        for (const gx of [0, W]) {
          if (goalDist(p.x, p.y, gx) < 6) {
            const q = pushOut(p.x, p.y, gx, 6.01);
            if (p.landT < 1.2) {
              const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy), m = Math.min(d, 3.5 * dt);
              if (d > 0) { p.x += (dx / d) * m; p.y += (dy / d) * m; }
            } else { p.x = q.x; p.y = q.y; }
          }
        }
      }
      p.x = clamp(p.x, -1.5, W + 1.5);
      p.y = clamp(p.y, -1.2, H + 1.2);
    }
  }

  // ---------------------------------------------------------------- AI
  computeRoles() {
    const b = this.ball;
    for (const t of this.teams) {
      this.chaser[t.idx] = null;
      this.presser[t.idx] = null;
      if (b.state === 'loose') {
        const inArea = goalDist(b.x, b.y, 0) < 6 || goalDist(b.x, b.y, W) < 6;
        if (!inArea) this.chaser[t.idx] = this.nearest(t, b.x, b.y);
      }
      const c = b.owner;
      if (c && c.team !== t.idx && !c.gk && goalDist(c.x, c.y, t.defX) < 12.5) {
        this.presser[t.idx] = this.nearest(t, c.x, c.y);
      }
    }
  }

  aiTarget(p) {
    const b = this.ball;
    if (p.gk) return this.gkTarget(p);
    if (b.owner === p) return this.carrierTarget(p);
    if (b.state === 'loose' && this.chaser[p.team] === p) return { x: b.x, y: b.y, s: 1 };
    if (b.state === 'pass' && b.passTo === p) return { x: b.tx, y: b.ty, s: 1 };
    return this.poss === p.team ? this.attackSlot(p) : this.defendSlot(p);
  }

  ballRef() {
    const b = this.ball;
    return b.owner ? b.owner : b;
  }

  attackSlot(p) {
    const t = this.teamOf(p), ax = this.attackX(t), s = this.dir(t), r = this.ballRef();
    const [u, lat] = ATTACK[p.role];
    let x = ax - s * u, y = CY + s * lat;
    if (p.role === 'PV') y = clamp(CY + (r.y - CY) * 0.5, 7.5, 12.5);
    else y += (r.y - CY) * 0.15;
    p.ai.cutT -= 1 / 60;
    if (p.ai.cutT <= 0) { p.ai.cut = 1.2; p.ai.cutT = rnd(3, 7); }
    if (p.ai.cut > 0) { p.ai.cut -= 1 / 60; x += s * 2.4; }
    let q = pushOut(x, y, ax, 6.4);
    x = q.x; y = q.y;
    const c = this.ball.owner;
    if (c && c !== p && c.team === p.team) {
      const dx = x - c.x, dy = y - c.y, d = hyp(dx, dy);
      if (d < 3) { x = c.x + (dx / (d || 1)) * 3; y = c.y + (dy / (d || 1)) * 3; }
    }
    // Step away from the closest defender to get open.
    let nd = 99, no = null;
    for (const o of this.opponents(p)) {
      if (o.gk) continue;
      const d = hyp(o.x - x, o.y - y);
      if (d < nd) { nd = d; no = o; }
    }
    if (no && nd < 1.6) { x += ((x - no.x) / (nd || 1)) * (1.6 - nd); y += ((y - no.y) / (nd || 1)) * (1.6 - nd); }
    q = pushOut(clamp(x, 0.6, W - 0.6), clamp(y, 0.6, H - 0.6), ax, 6.3);
    const far = Math.abs(r.x - ax) > 20;
    return { x: q.x, y: q.y, s: far ? 1 : 0.85 };
  }

  defendSlot(p) {
    const t = this.teamOf(p), gx = t.defX, r = this.ballRef(), c = this.ball.owner;
    if (this.presser[p.team] === p && c) {
      const dx = gx - c.x, dy = CY - c.y, d = hyp(dx, dy) || 1;
      return { x: c.x + (dx / d) * 0.95, y: c.y + (dy / d) * 0.95, s: 1 };
    }
    let tt = DEF_T[p.role];
    if (gx === W) tt = 1 - tt;
    const tb = dParam(gx, 7, r.x, r.y);
    tt = clamp(tt + (tb - 0.5) * 0.4, 0.03, 0.97);
    const depth = p.role === 'LB' || p.role === 'RB' || p.role === 'CB' ? 7.3 : 6.7;
    const q = dPoint(gx, depth, tt);
    return { x: clamp(q.x, 0.4, W - 0.4), y: clamp(q.y, 0.4, H - 0.4), s: 1 };
  }

  gkHome(p) {
    const gx = this.teamOf(p).defX, s = this.dir(this.teamOf(p)), r = this.ballRef();
    const a = clamp(Math.atan2(r.y - CY, s * (r.x - gx)), -1.3, 1.3);
    return { x: gx + s * Math.cos(a) * 0.9, y: CY + Math.sin(a) * 1.3, s: 0.8 };
  }

  gkTarget(p) {
    const b = this.ball, t = this.teamOf(p), gx = t.defX, s = this.dir(t);
    if (b.owner === p) return { x: p.x, y: p.y, s: 0 };
    if (b.state === 'shot' && b.goalX === gx) {
      if (p.frozen > 0 || b.age < this.diffFor(p).react || Math.abs(b.vx) < 0.1) return { x: p.x, y: p.y, s: 0 };
      const gkx = gx + s * 0.55;
      const py = clamp(b.y + b.vy * ((gkx - b.x) / b.vx), POST_LO - 0.3, POST_HI + 0.3);
      if (!p.action && Math.abs(py - p.y) > 0.45) { p.action = 'dive'; p.actT = 0; p.diveDir = Math.sign(py - p.y); }
      return { x: gkx, y: py, s: 1.3 };
    }
    if (b.state === 'loose' && goalDist(b.x, b.y, gx) < 5.8) return { x: b.x, y: b.y, s: 1 };
    if (this.lock && this.lock.penalty && this.lock.p.team !== p.team) return { x: gx + s * 0.8, y: CY, s: 0.6 };
    return this.gkHome(p);
  }

  carrierTarget(p) {
    if (p.gk || p.carry === 'held') return { x: p.x, y: p.y, s: 0 };
    const t = this.teamOf(p), ax = this.attackX(t);
    let tt = dParam(ax, 6.6, p.x, p.y);
    if (p.role !== 'LW' && p.role !== 'RW') tt = lerp(tt, 0.5, 0.3);
    let q = dPoint(ax, 6.6, tt);
    // Sidestep a defender standing right in the way.
    const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy) || 1;
    for (const o of this.opponents(p)) {
      if (o.gk) continue;
      const ox = o.x - p.x, oy = o.y - p.y, od = hyp(ox, oy);
      if (od < 1.8 && (ox * dx + oy * dy) / (od * d) > 0.6) {
        const side = (ox * dy - oy * dx) > 0 ? 1 : -1;
        q = { x: p.x + (dx / d) * 1.5 + (dy / d) * side * 1.6, y: p.y + (dy / d) * 1.5 - (dx / d) * side * 1.6 };
        break;
      }
    }
    return { x: q.x, y: q.y, s: 0.85 };
  }

  shotQuality(p) {
    const t = this.teamOf(p), ax = this.attackX(t);
    const d = goalDist(p.x, p.y, ax);
    if (d > 11.5) return 0;
    const lat = Math.abs(p.y - CY), fwd = Math.abs(ax - p.x);
    const angleF = clamp(0.45 + (fwd / Math.max(0.1, lat)) * 0.45, 0, 1);
    let q = (1 - (d - 6) / 5.5) * angleF;
    for (const o of this.opponents(p)) {
      if (o.gk) continue;
      const r = distToSegment(o.x, o.y, p.x, p.y, ax, CY);
      if (r.d < 0.7 && r.t > 0.04) q -= 0.3;
    }
    if (this.nearestOppDist(p) < 1.0) q -= 0.12;
    return q;
  }

  bestPass(p, forced = false) {
    const t = this.teamOf(p), ax = this.attackX(t);
    let best = null, bs = -1e9;
    for (const m of this.mates(p)) {
      if (m.gk) continue;
      const d = hyp(m.x - p.x, m.y - p.y);
      if (d < 2 || d > (p.gk ? 34 : 22)) continue;
      const open = Math.min(this.nearestOppDist(m), 4);
      let lane = 99;
      for (const o of this.opponents(p)) {
        if (o.gk) continue;
        const r = distToSegment(o.x, o.y, p.x, p.y, m.x, m.y);
        if (r.t > 0.08 && r.t < 0.95) lane = Math.min(lane, r.d);
      }
      const lanePen = lane < 0.8 ? 2 : lane < 1.4 ? 0.7 : 0;
      const progress = (goalDist(p.x, p.y, ax) - goalDist(m.x, m.y, ax)) * 0.1;
      const s = open * 0.6 + progress - lanePen - (m === this.ball.passerOf?.[p.id] ? 0.6 : 0) + rnd(0, 0.6);
      if (s > bs) { bs = s; best = m; }
    }
    return forced || bs > -0.5 ? best : null;
  }

  aiCarrier(p, dt) {
    if (this.state !== 'play') return;
    const ai = p.ai, d = this.diffFor(p);
    if (this.lock && this.lock.p === p) {
      ai.delay -= dt;
      if (ai.delay > 0) return;
      if (this.lock.penalty) { this.shoot(p, null, rnd(0.5, 1)); return; }
      if (this.sp && this.sp.type === 'freethrow' && this.shotQuality(p) > 0.3 && Math.random() < 0.3) {
        this.shoot(p, null, rnd(0.6, 1)); return;
      }
      const t = this.bestPass(p, true);
      if (t) this.pass(p, t);
      return;
    }
    if (p.gk) {
      if (p.ballT > ai.holdLimit) { const t = this.bestPass(p, true); if (t) this.pass(p, t); }
      return;
    }
    ai.think -= dt;
    if (ai.think > 0) return;
    ai.think = d.think * rnd(0.7, 1.3);
    const q = this.shotQuality(p);
    let th = 0.42;
    if (this.passive) th -= this.passivePasses * 0.08;
    if (p.holdT > 2.2) th -= 0.2;
    if (q > th + rnd(-0.1, 0.1)) { this.shoot(p, null, rnd(0.45, 0.95)); return; }
    const limit = p.carry === 'held' ? 0.9 : ai.holdLimit;
    const pressure = this.nearestOppDist(p) < 1.1;
    if (p.ballT > limit || (pressure && Math.random() < 0.35) || (p.carry !== 'drib' && p.holdT > 1.8)) {
      if (this.passive && this.passivePasses >= 4) { this.shoot(p, null, rnd(0.6, 1)); return; }
      const t = this.bestPass(p, p.holdT > 2);
      if (t) { this.pass(p, t); return; }
      if (q > 0.12) this.shoot(p, null, rnd(0.6, 1));
    }
  }

  aiDefendAction(p, dt) {
    const c = this.ball.owner;
    if (!c || c.gk || p.stealCd > 0) return;
    const d = hyp(c.x - p.x, c.y - p.y);
    if (d > 1.15) return;
    const front = (Math.cos(c.face) * (p.x - c.x) + Math.sin(c.face) * (p.y - c.y)) / (d || 1);
    const rate = this.diffFor(p).steal * 0.7 * (front < -0.3 ? 0.25 : 1);
    if (Math.random() < rate * dt) this.tackle(p);
  }

  setupTarget(p) {
    const type = this.state === 'goal' ? 'throwoff' : this.sp.type;
    const possT = this.state === 'goal' ? this.concede : this.sp.team;
    const sx = this.state === 'goal' ? CX : this.sp.x, sy = this.state === 'goal' ? CY : this.sp.y;
    const t = this.teamOf(p);
    let q = p.gk ? this.gkHome(p) : p.team === possT ? this.attackSlot(p) : this.defendSlot(p);
    q = { x: q.x, y: q.y, s: 1 };
    if (type === 'throwoff') {
      q.x = t.defX === 0 ? Math.min(q.x, CX - 0.6) : Math.max(q.x, CX + 0.6);
      if (p.team !== possT) q = this.keepAway(q, CX, CY, 3.2);
    } else if (type === 'penalty') {
      const gx = this.attackX(this.teams[possT]);
      if (p.gk && p.team !== possT) q = { x: gx + (gx === 0 ? 1 : -1) * 0.8, y: CY, s: 1 };
      else if (!p.gk) { q = pushOut(q.x, q.y, gx, 9.6); q = this.keepAway(q, sx, sy, 3.2); }
    } else {
      if (type === 'freethrow' && p.team === possT && !p.gk) q = pushOut(q.x, q.y, this.attackX(t), 9.3);
      if (p.team !== possT && !p.gk) q = this.keepAway(q, sx, sy, 3.2);
    }
    return q;
  }

  keepAway(q, x, y, r) {
    const dx = q.x - x, dy = q.y - y, d = hyp(dx, dy);
    if (d >= r) return q;
    if (d < 1e-3) return { x: x + r, y, s: 1 };
    return { x: x + (dx / d) * r, y: y + (dy / d) * r, s: 1 };
  }

  placeAll(possTeam) {
    this.ball.owner = null;
    this.ball.x = CX; this.ball.y = CY; this.ball.z = 0;
    this.chaser = [null, null]; this.presser = [null, null];
    this.state = 'goal'; this.concede = possTeam;
    for (const p of this.all) {
      p.vx = p.vy = 0; p.z = 0; p.air = false; p.action = null; p.carry = null;
      if (!p.active) { this.benchPose(p, 0); continue; }
      const q = this.setupTarget(p);
      p.x = q.x; p.y = q.y;
      p.face = this.dir(this.teamOf(p)) > 0 ? 0 : Math.PI;
    }
  }

  // ---------------------------------------------------------------- actions
  setOwner(p) {
    const b = this.ball;
    if (b.owner && b.owner !== p) { b.owner.carry = null; b.owner.charging = false; b.owner.charge = 0; }
    const prev = this.poss;
    b.owner = p; b.state = 'held'; b.passTo = null; b.vx = b.vy = b.vz = 0;
    b.last = p; b.lastTeam = p.team;
    p.carry = 'fresh'; p.holdT = 0; p.stepDist = 0; p.ballT = 0; p.stillT = 0;
    p.ai.holdLimit = p.gk ? rnd(0.6, 1.4) : rnd(0.7, 2.0);
    p.ai.think = rnd(0.1, 0.3);
    if (prev !== p.team) this.changePossession(p.team);
    if (this.pendingPower) {
      if (p === this.pendingPower) this.powers.start(p);
      else this.pendingPower = null;
    }
    this.emit({ type: 'catch', team: p.team });
  }

  changePossession(team) {
    this.ball.power = null;
    if (this.poss !== team) this.teams[this.poss].stats.turnovers++;
    this.poss = team; this.attackT = 0; this.passive = false; this.passivePasses = 0;
    const h = this.opts.human;
    if (h >= 0 && team !== h) this.controlled = this.nearest(this.teams[h], this.ball.x, this.ball.y);
  }

  releaseFrom(p) {
    const b = this.ball;
    b.owner = null; b.ignore = p; b.age = 0; b.tried.clear(); b.last = p; b.lastTeam = p.team;
    p.carry = null; p.charging = false; p.charge = 0;
    if (this.lock && this.lock.p === p) this.lock = null;
  }

  pass(p, m) {
    const b = this.ball;
    if (this.full && this.passive && this.poss === p.team) {
      if (this.passivePasses >= 4) { this.violation('passive', p); return; }
      this.passivePasses++;
    }
    let tx = m.x, ty = m.y;
    let d = hyp(tx - p.x, ty - p.y);
    const speed = clamp(10 + d * 0.35, 11, 18) * PACE;
    const T0 = d / speed;
    tx += m.vx * T0 * 0.8; ty += m.vy * T0 * 0.8;
    for (const gx of [0, W]) if (!m.gk) { const q = pushOut(tx, ty, gx, 6.2); tx = q.x; ty = q.y; }
    tx = clamp(tx, 0.3, W - 0.3); ty = clamp(ty, 0.3, H - 0.3);
    const pressure = this.nearestOppDist(p) < 1.2 ? 1 : 0;
    const ang = Math.atan2(ty - p.y, tx - p.x) + gauss() * (0.02 + pressure * 0.04);
    this.releaseFrom(p);
    b.state = 'pass'; b.passTo = m; b.tx = tx; b.ty = ty;
    b.passerOf = { [m.id]: p };
    b.x = p.x; b.y = p.y; b.z = p.z + 0.9;
    d = hyp(tx - b.x, ty - b.y);
    const T = Math.max(0.12, d / speed);
    b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
    b.vz = (1.2 - b.z + 0.5 * G * T * T) / T;
    p.action = 'pass'; p.actT = 0;
    this.emit({ type: 'pass', team: p.team });
  }

  shoot(p, aimLat, power) {
    const b = this.ball, t = this.teamOf(p), ax = this.attackX(t), s = this.dir(t);
    const gk = this.keeper(this.teams[1 - p.team]);
    let ty;
    if (aimLat != null) ty = CY + clamp(aimLat, -1, 1) * 1.3;
    else {
      const away = gk && gk.y < CY ? 1 : -1;
      ty = CY + (Math.random() < 0.75 ? away : -away) * rnd(0.4, 1.35);
    }
    let tz = rnd(0.25, 1.75);
    const d = hyp(ax - p.x, ty - p.y);
    const pressure = this.nearestOppDist(p) < 1.2 ? 1 : 0;
    const aim = this.diffFor(p).aim * this.powers.mod(p, 'shotError');
    const err = (0.12 + 0.03 * d + pressure * 0.25 + power * 0.22) * aim;
    ty += gauss() * err; tz += gauss() * err * 0.6;
    const speed = (15.5 + power * 9) * PACE * this.powers.mod(p, 'shotSpeed');
    if (!p.gk && !p.air) { p.air = true; p.vz = 3.4; p.z = 0.02; p.vx += s * 1.8; }
    p.action = 'shoot'; p.actT = 0;
    this.releaseFrom(p);
    b.state = 'shot'; b.shooter = p; b.goalX = ax; b.checkedGK = false;
    b.shotDist = goalDist(p.x, p.y, ax);
    b.x = p.x + s * 0.2; b.y = p.y; b.z = p.z + 1.4;
    const dx = ax - b.x, dy = ty - b.y, dist = hyp(dx, dy), T = dist / speed;
    b.vx = (dx / dist) * speed; b.vy = (dy / dist) * speed;
    b.vz = (tz - b.z + 0.5 * G * T * T) / T;
    t.stats.shots++;
    this.passive = false; this.passivePasses = 0; this.attackT = 0;
    if (b.power) {
      const fx = this.powers.fx;
      b.powerShot = true;
      if (gk && fx.freezeKeeper) gk.frozen = fx.freezeKeeper;
      p.effects = p.effects.filter((e) => e.id !== 'power');
      this.emit({ type: 'powershot', kind: b.power, team: p.team });
    }
    this.emit({ type: 'shot', team: p.team, power });
  }

  tackle(def) {
    if (def.stealCd > 0) return;
    def.stealCd = 0.8; def.action = 'steal'; def.actT = 0; def.stance = 0.5;
    const b = this.ball, c = b.owner;
    if (!c || c.team === def.team || c.gk) return;
    const d = hyp(c.x - def.x, c.y - def.y);
    if (d > 1.35) return;
    const front = (Math.cos(c.face) * (def.x - c.x) + Math.sin(c.face) * (def.y - c.y)) / (d || 1);
    let ps, pf, severe = false;
    if (front < -0.3) { ps = 0.12; pf = 0.75; severe = true; }
    else if (front > 0.3) { ps = 0.4; pf = 0.15; }
    else { ps = 0.28; pf = 0.35; }
    if (c.carry === 'drib') ps += 0.12;
    ps /= this.powers.mod(c, 'stealResist');
    const r = Math.random();
    if (r < ps) {
      this.teams[def.team].stats.steals++;
      this.powers.gain(this.teams[def.team], 'steal');
      this.setOwner(def);
      this.say('חטיפה!', '', 1, 'soft');
      this.emit({ type: 'steal', team: def.team });
    } else if (r < ps + pf * (1 - ps)) {
      this.foul(def, c, severe);
    } else {
      c.slowT = 0.35;
    }
  }

  foul(def, att, severe) {
    const dt = this.teams[def.team], at = this.teams[att.team];
    dt.stats.fouls++;
    this.emit({ type: 'whistle', n: 1 });
    let card = '';
    if (this.full) {
      let escalate = severe;
      if (!severe && ++def.fouls >= 3) { def.fouls = 0; escalate = true; }
      if (escalate) {
        if (!def.yellow) { def.yellow = true; card = 'yellow'; }
        else { this.suspend(def); card = def.red ? 'red' : '2min'; }
      }
    }
    const ax = this.attackX(at), s = this.dir(at);
    const gd = goalDist(att.x, att.y, ax);
    let clear = false;
    if (gd < 9.5) {
      const facing = Math.cos(att.face) * (ax - att.x) + Math.sin(att.face) * (CY - att.y) > 0;
      const blocked = dt.players.some((o) => o.active && !o.gk && o !== def &&
        distToSegment(o.x, o.y, att.x, att.y, ax, CY).d < 1.0 && goalDist(o.x, o.y, ax) < gd);
      clear = facing && !blocked;
    }
    const cardTitle = { yellow: 'כרטיס צהוב', '2min': '2 דקות בחוץ', red: 'כרטיס אדום' }[card];
    const cardSub = card ? `${heName(def)} · ` : '';
    if (clear) {
      this.setPiece('penalty', att.team, ax - s * PEN_D, CY, {
        title: cardTitle || 'זריקת 7 מטר!', sub: `${cardSub}7 מטר ${at.kit.to}`, signal: card || 'penalty',
      });
    } else {
      let q = { x: clamp(att.x, 0.5, W - 0.5), y: clamp(att.y, 0.2, H - 0.2) };
      if (goalDist(q.x, q.y, ax) < 9) q = pushOut(q.x, q.y, ax, 9.05);
      this.setPiece('freethrow', att.team, q.x, q.y, {
        title: cardTitle || (severe ? 'עבירה מאחור' : 'עבירה'), sub: `${cardSub}חופשית ${at.kit.to}`, signal: card || 'free',
      });
    }
  }

  suspend(p) {
    const t = this.teams[p.team];
    p.suspCount++;
    if (p.suspCount >= 3) p.red = true;
    p.susp = this.suspLen; p.active = false; p.air = false; p.z = 0;
    t.stats.suspensions++;
    if (this.controlled === p) this.controlled = null;
    this.emit({ type: 'card', kind: p.red ? 'red' : '2min', team: p.team });
  }

  updateSuspensions(dt) {
    for (const p of this.all) {
      if (p.active) continue;
      p.susp -= dt;
      if (p.susp <= 0) {
        const t = this.teamOf(p);
        p.active = true;
        p.x = t.defX === 0 ? CX - 4.5 : CX + 4.5; p.y = H - 0.3;
        if (p.red) {
          p.red = false; p.suspCount = 0; p.yellow = false; p.num += 20;
          this.say(`${t.kit.he} שוב בשבעה`, '', 1.4, 'soft');
        }
      }
    }
  }

  benchPose(p, dt) {
    const t = this.teamOf(p);
    const bx = (t.defX === 0 ? CX - 7 : CX + 7) + (p.id % 10) * 0.6;
    p.x = bx; p.y = H + 1.6; p.vx = p.vy = 0; p.z = 0;
    p.face = -Math.PI / 2;
  }

  violation(kind, p) {
    const other = 1 - p.team;
    const title = VIOLATIONS[kind];
    this.emit({ type: 'whistle', n: 1 });
    const ax = this.attackX(this.teams[other]);
    let q = { x: clamp(p.x, 0.5, W - 0.5), y: clamp(p.y, 0.2, H - 0.2) };
    if (goalDist(q.x, q.y, ax) < 9) q = pushOut(q.x, q.y, ax, 9.05);
    this.setPiece('freethrow', other, q.x, q.y, { title, sub: `חופשית ${this.teams[other].kit.to}`, signal: kind });
  }

  setPiece(type, teamIdx, x, y, o = {}) {
    const t = this.teams[teamIdx], b = this.ball;
    if (b.owner) { b.owner.carry = null; b.owner.charging = false; b.owner.charge = 0; }
    b.owner = null;
    let taker;
    if (type === 'throwoff') taker = t.players.find((p) => p.role === 'CB' && p.active);
    else if (type === 'penalty') taker = ['RB', 'LB', 'CB', 'PV'].map((r) => t.players.find((p) => p.role === r && p.active)).find(Boolean);
    if (!taker) taker = this.nearest(t, x, y);
    if (type !== 'throwoff' && type !== 'penalty') {
      for (const gx of [0, W]) { const q = pushOut(x, y, gx, 6.1); x = q.x; y = q.y; }
    }
    taker.x = x; taker.y = y; taker.vx = taker.vy = 0; taker.air = false; taker.z = 0;
    taker.face = Math.atan2(CY - y, this.attackX(t) - x);
    this.sp = { type, team: teamIdx, x, y, taker, t: 0, setup: type === 'penalty' ? 1.8 : type === 'throwoff' ? 1.1 : 0.9 };
    this.state = 'setpiece';
    this.setOwner(taker);
    taker.carry = 'fresh';
    taker.ai.delay = rnd(0.3, 0.9);
    this.lock = { p: taker, penalty: type === 'penalty' };
    const names = { throwoff: 'זריקת פתיחה', freethrow: 'זריקה חופשית', throwin: 'זריקת חוץ', penalty: 'זריקת 7 מטר!' };
    const title = o.title || names[type];
    this.say(title, o.sub || `הכדור ${t.kit.to}`, type === 'penalty' ? 2 : 1.5, o.title ? 'rule' : 'info');
    if (o.signal) this.signal = { type: o.signal, t: 2 };
    this.emit({ type: 'setpiece', kind: type, team: teamIdx });
  }

  // ---------------------------------------------------------------- ball
  updateBall(dt) {
    const b = this.ball;
    if (b.power && !b.powerShot && (this.powerT -= dt) <= 0) b.power = null;
    if (b.powerShot && b.state !== 'shot') { b.power = null; b.powerShot = false; }
    if (b.owner) {
      const p = b.owner, fx = Math.cos(p.face) >= 0 ? 1 : -1;
      b.y = p.y + 0.02;
      if (p.charging) { b.x = p.x - fx * 0.44; b.z = p.z + 1.37; }
      else if (p.carry === 'drib') { b.x = p.x + fx * 0.27; b.bounce += dt * 7; b.z = 0.19 + Math.abs(Math.sin(b.bounce)) * 0.3; }
      else { b.x = p.x + fx * 0.29; b.z = p.z + 0.64; }
      return;
    }
    if (b.state === 'dead') return;
    b.age += dt;
    const px = b.x, py = b.y, pz = b.z;
    b.vz -= G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -1.2) {
        b.vz = -b.vz * 0.5; b.vx *= 0.85; b.vy *= 0.85;
        if (b.state === 'pass') b.state = 'loose';
      } else b.vz = 0;
    }
    if (b.z === 0 && b.vz === 0) {
      if (b.state !== 'loose') b.state = 'loose';
      const f = Math.max(0, 1 - 2.2 * dt);
      b.vx *= f; b.vy *= f;
    }

    // Goal lines
    for (const gx of [0, W]) {
      if ((px - gx) * (b.x - gx) <= 0 && px !== gx) {
        const f = (gx - px) / (b.x - px);
        const cy = py + (b.y - py) * f, cz = pz + (b.z - pz) * f;
        const nearPost = Math.abs(cy - POST_LO) < 0.08 || Math.abs(cy - POST_HI) < 0.08;
        const bar = cy > POST_LO && cy < POST_HI && Math.abs(cz - GOAL_H) < 0.08;
        if ((nearPost && cz < GOAL_H + 0.05) || bar) {
          b.x = px; b.y = py;
          b.vx = -b.vx * 0.45; b.vy += rnd(-3, 3); b.vz = Math.abs(b.vz) * 0.3 + 0.5;
          b.state = 'loose';
          this.emit({ type: 'post' });
          this.say(bar ? 'משקוף!' : 'קורה!', '', 1, 'soft');
          return;
        }
        if (cy > POST_LO && cy < POST_HI && cz < GOAL_H) { this.goal(gx); return; }
        this.ballOut('goalline', gx, cy);
        return;
      }
    }
    if (b.y < 0 || b.y > H) { this.ballOut('side', b.x, b.y < 0 ? 0 : H); return; }

    if (b.state === 'shot') { if (this.shotContacts(px, py)) return; }
    else this.catchCheck();
  }

  shotContacts(px, py) {
    const b = this.ball, gx = b.goalX, s = gx === 0 ? 1 : -1;
    const def = this.teams.find((t) => t.defX === gx);
    const fx = b.power ? this.powers.fx : {};
    if (fx.freezeKeeper) return false; // keeper frozen and blocks don't stop it
    for (const o of def.players) {
      if (fx.unblockable) break;
      if (!o.active || o.gk || b.tried.has(o)) continue;
      const d = hyp(o.x - b.x, o.y - b.y);
      if (d < 0.45 + (o.stance > 0 ? 0.25 : 0) && b.z < 2.1 + o.z) {
        b.tried.add(o);
        if (Math.random() < (o.stance > 0 ? 0.75 : 0.5)) {
          b.vx = -b.vx * 0.25 + rnd(-2, 2); b.vy = b.vy * 0.3 + rnd(-3, 3); b.vz = 1.5;
          b.state = 'loose'; b.last = o; b.lastTeam = o.team;
          this.say('נחסם!', '', 0.9, 'soft');
          this.emit({ type: 'block' });
          return true;
        }
      }
    }
    const gk = this.keeper(def);
    if (gk && !b.checkedGK && (px - gk.x) * (b.x - gk.x) <= 0) {
      b.checkedGK = true;
      const f = (gk.x - px) / ((b.x - px) || 1e-6);
      const cy = py + (b.y - py) * f;
      const dy = Math.abs(cy - gk.y);
      const reach = (0.5 + (gk.action === 'dive' ? 0.55 : 0.2)) * this.powers.mod(gk, 'gkReach');
      if (dy < reach && b.z < 2.25) {
        const sp = hyp(b.vx, b.vy);
        let pr = clamp(this.diffFor(gk).gk + 0.3 * (1 - dy / reach) - (sp / PACE - 18) / 35 + (b.shotDist - 7) * 0.03, 0.08, 0.92);
        if (fx.keeperSave != null) pr *= fx.keeperSave;
        if (Math.random() < pr) {
          def.stats.saves++;
          this.powers.gain(def, 'save');
          this.emit({ type: 'save', team: def.idx });
          if (sp < 19 * PACE && Math.random() < 0.45) {
            this.setOwner(gk);
            this.say('הצלה!', heName(gk), 1.2, 'soft');
          } else {
            b.vx = s * rnd(2, 5); b.vy = rnd(-5, 5); b.vz = rnd(1, 3);
            b.state = 'loose'; b.last = gk; b.lastTeam = gk.team;
            this.say('הצלה!', '', 1, 'soft');
          }
          return true;
        }
      }
    }
    return false;
  }

  catchCheck() {
    const b = this.ball;
    const inArea0 = goalDist(b.x, b.y, 0) < 6, inAreaW = goalDist(b.x, b.y, W) < 6;
    let best = null, bd = 1e9;
    for (const p of this.all) {
      if (!p.active) continue;
      if (p === b.ignore && b.age < 0.35) continue;
      if (b.z > (p.gk ? 2.3 : 2.05) + p.z) continue;
      if (!p.gk && (inArea0 || inAreaW)) continue;
      if (p.gk && goalDist(b.x, b.y, this.teamOf(p).defX) > 6.3) continue;
      const d = hyp(p.x - b.x, p.y - b.y);
      const m = this.powers.mod(p, 'catchRadius');
      let r = (p.gk ? 0.65 : 0.5) * m;
      if (b.state === 'pass') {
        if (p === b.passTo) r = 0.75 * m;
        else if (p.team !== b.lastTeam) {
          if (d >= r || b.tried.has(p)) continue;
          b.tried.add(p);
          if (Math.random() >= this.diffFor(p).intercept * (b.z < 1.6 ? 1 : 0.5)) continue;
        }
      } else if (b.z > 1.3 + p.z) continue;
      if (d < r && d < bd) { bd = d; best = p; }
    }
    if (best) this.setOwner(best);
  }

  goal(gx) {
    const b = this.ball, s = gx === 0 ? 1 : -1;
    const t = this.teams.find((x) => x.defX !== gx), other = this.teams[1 - t.idx];
    t.score++; t.stats.goals++;
    this.powers.gain(t, 'goal');
    const scorer = b.state === 'shot' && b.shooter && b.shooter.team === t.idx ? b.shooter : b.last && b.last.team === t.idx ? b.last : null;
    this.say('גול!', scorer ? heName(scorer) : t.kit.he, 2.2, 'goal');
    this.signal = { type: 'goal', t: 1.6 };
    this.emit({ type: 'goal', team: t.idx });
    this.emit({ type: 'whistle', n: 1 });
    b.state = 'dead'; b.owner = null; b.vx = b.vy = b.vz = 0;
    b.x = gx - s * 0.6; b.z = 0.2;
    this.lock = null;
    this.state = 'goal'; this.timer = 2.2; this.concede = other.idx;
  }

  ballOut(kind, x, y) {
    const b = this.ball;
    if (kind === 'goalline') {
      const def = this.teams.find((t) => t.defX === x);
      if (b.last && b.last.team === def.idx && !b.last.gk) {
        this.emit({ type: 'whistle', n: 1 });
        this.setPiece('throwin', 1 - def.idx, x === 0 ? 0.3 : W - 0.3, y < CY ? 0 : H, { title: 'זריקת קרן' });
      } else {
        const gk = this.keeper(def);
        if (!gk) { this.setPiece('throwin', def.idx, x === 0 ? 0.3 : W - 0.3, y < CY ? 0 : H); return; }
        b.state = 'held';
        this.lock = null;
        this.setOwner(gk);
        this.say('כדור לשוער', '', 1, 'soft');
      }
    } else {
      this.emit({ type: 'whistle', n: 1 });
      this.setPiece('throwin', 1 - b.lastTeam, clamp(x, 0.5, W - 0.5), y);
    }
  }

  // ---------------------------------------------------------------- rules
  updateRules(dt) {
    const b = this.ball, c = b.owner;
    this.attackT += dt;
    if (c) {
      c.ballT += dt;
      const sp = hyp(c.vx, c.vy);
      const locked = this.lock && this.lock.p === c;
      if (locked) c.holdT += dt;
      else if (!c.gk) {
        if (c.carry === 'fresh') { c.holdT += dt; if (sp > 1.0) { c.carry = 'drib'; c.stillT = 0; } }
        else if (c.carry === 'drib') {
          if (sp < 0.6) { c.stillT += dt; if (c.stillT > 0.3) { c.carry = 'held'; c.holdT = 0; c.stepDist = 0; } }
          else c.stillT = 0;
        } else if (c.carry === 'held') { c.holdT += dt; c.stepDist += sp * dt; }
      }
      if (this.full && !c.gk) {
        if (c.carry === 'held' && !locked && c.stepDist > 2.6) { this.violation('steps', c); return; }
        if ((c.carry === 'held' || c.carry === 'fresh') && c.holdT > 3) { this.violation('three', c); return; }
      }
      if (!c.air && !c.gk && (c.y < -0.05 || c.y > H + 0.05 || c.x < -0.05 || c.x > W + 0.05)) {
        b.last = c; b.lastTeam = c.team;
        if (c.x < 0 || c.x > W) this.ballOut('goalline', c.x < 0 ? 0 : W, c.y);
        else this.ballOut('side', c.x, c.y < 0 ? 0 : H);
        return;
      }
    }
    if (this.full && !this.passive && this.attackT > this.passiveTime) {
      this.passive = true; this.passivePasses = 0;
      this.signal = { type: 'passive', t: 3 };
      this.say('משחק פסיבי!', '4 מסירות ואז לזרוק', 2, 'rule');
      this.emit({ type: 'warn' });
    }
  }

  endHalf() {
    this.emit({ type: 'whistle', n: 3 });
    this.lock = null;
    if (this.half === 1) {
      this.state = 'halftime';
      this.say('מחצית', '', 3, 'info');
    } else {
      this.state = 'fulltime';
      this.say('סיום המשחק', '', 3, 'info');
    }
  }

  startSecondHalf() {
    this.half = 2; this.clock = 0;
    for (const t of this.teams) t.defX = t.defX === 0 ? W : 0;
    const first = 1 - this.firstThrow;
    this.poss = first;
    this.placeAll(first);
    this.setPiece('throwoff', first, CX, CY, { title: 'מחצית שנייה', sub: 'מחליפים צדדים' });
  }

  updateRefs(dt) {
    const r = this.ballRef();
    const t = this.teams[this.poss], s = this.dir(t), ax = this.attackX(t);
    const targets = [
      { x: clamp(r.x - s * 5, 3, W - 3), y: -0.9 },
      { x: ax - s * 1.2, y: -0.9 },
    ];
    this.refs.forEach((f, i) => {
      const q = targets[i];
      const dx = q.x - f.x, dy = q.y - f.y, d = hyp(dx, dy);
      const v = Math.min(5.5, d * 2);
      f.vx = d > 0.05 ? (dx / d) * v : 0; f.vy = d > 0.05 ? (dy / d) * v : 0;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.phase += hyp(f.vx, f.vy) * dt * 3.1;
      f.face = Math.abs(f.vx) > 0.3 ? (f.vx > 0 ? 0 : Math.PI) : Math.PI / 2;
    });
  }

  clockText() {
    const total = (this.half - 1) * this.opts.halfLen + Math.min(this.clock, this.opts.halfLen);
    const m = Math.floor(total / 60), s = Math.floor(total % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
