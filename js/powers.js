// Special powers. Each team has one power hero (yours: from a photo; the computer's: Venom) with a
// power template (Lightning, Fire, Muscle, Captain). The template's `fx` says what the power does;
// the game asks mod() for multipliers wherever a power can matter (speed, shotSpeed, shotError,
// catchRadius, stealResist, gkReach), and reads fx for the shot itself (unblockable, freezeKeeper,
// keeperSave).
//
// Flow: the meter fills -> POWER -> close-up of the team's hero -> the ball is powered for `duration`
// seconds in the carrier's hands (or as soon as the team gets it) -> a powered shot uses fx.

export const POWERS_ENABLED = true;
export const ENERGY_MAX = 100;
const COST = 100;
const DURATION = 10;
const GAIN = { second: 3.5, goal: 25, save: 20, steal: 15 }; // yours: full again in under 30 s
const RIVAL_GAIN = 0.35; // the computer's meter fills about 3x slower, so it doesn't spam powers

export class PowerSystem {
  constructor(game) {
    this.game = game;
    this.enabled = POWERS_ENABLED;
    this.teams = [null, null]; // per team: { template, profile, hero (player) }
  }

  configure(teamIdx, template, profile, hero) {
    this.teams[teamIdx] = { template, profile, hero };
  }

  fxFor(teamIdx) {
    const t = this.teams[teamIdx];
    return (t && t.template.fx) || {};
  }

  // Product of all active effects on this player for a modifier key (1 when none).
  mod(player, key) {
    let m = 1;
    if (!player || !player.effects) return m;
    for (const e of player.effects) if (e.mods && e.mods[key]) m *= e.mods[key];
    return m;
  }

  rate(team) { return this.game.isHuman(team.idx) ? 1 : RIVAL_GAIN; }

  gain(team, what) {
    team.energy = Math.min(ENERGY_MAX, team.energy + (GAIN[what] || 0) * this.rate(team));
  }

  update(dt) {
    for (const t of this.game.teams) {
      t.energy = Math.min(ENERGY_MAX, t.energy + GAIN.second * this.rate(t) * dt);
      for (const p of t.players) {
        if (!p.effects.length) continue;
        for (const e of p.effects) e.t -= dt;
        p.effects = p.effects.filter((e) => e.t > 0);
      }
    }
  }

  // Called when POWER is pressed (or the computer decides). Returns:
  //   true      the power fired now (your team has the ball: the ball gets the power at once)
  //   'armed'   your team doesn't have the ball yet: it fires the moment you get it
  //   'energy'  the meter isn't full
  activate(teamIdx) {
    const info = this.teams[teamIdx];
    if (!this.enabled || !info) return 'off';
    const g = this.game, team = g.teams[teamIdx], b = g.ball;
    if (b.power || g.splash > 0) return true;
    if (team.energy < COST) return 'energy';
    if (b.owner && b.owner.team === teamIdx) { this.start(b.owner); return true; }
    info.armed = true;
    return 'armed';
  }

  // The team just got the ball: fire an armed power.
  onCatch(p) {
    const info = this.teams[p.team];
    // stays armed while the rivals pass the ball around, until your team gets it
    if (info && info.armed && !this.game.ball.power) this.start(p);
  }

  start(carrier) {
    const g = this.game, info = this.teams[carrier.team], tp = info.template, fx = tp.fx, team = g.teams[carrier.team];
    info.armed = false;
    team.energy = Math.max(0, team.energy - COST);
    carrier.effects = carrier.effects.filter((e) => e.id !== 'power');
    carrier.effects.push({ id: 'power', t: DURATION, mods: { shotSpeed: fx.speed || 1, shotError: fx.aim || 1 } });
    if (fx.teamSpeed) {
      for (const p of team.players) {
        if (!p.active || p.gk) continue;
        p.effects = p.effects.filter((e) => e.id !== 'rally');
        p.effects.push({ id: 'rally', t: fx.teamTime || 6, mods: { speed: fx.teamSpeed } });
      }
    }
    if (fx.freezeTeam) {
      // ice only holds a player's team for 1.5 s, so nobody feels stuck for long
      const secs = g.isHuman(1 - carrier.team) ? 1.5 : fx.freezeTeam;
      for (const p of g.teams[1 - carrier.team].players) if (p.active) { p.frozen = secs; p.iced = true; }
    }
    g.ball.power = tp.ball;
    g.ball.powerTeam = carrier.team;
    g.powerT = DURATION;
    g.splash = 1.8;
    g.splashInfo = info;
    g.say(tp.title(info.profile.nameHe), tp.sub, 1.9, 'power');
    g.emit({ type: 'power', kind: tp.key, team: carrier.team });
  }
}
