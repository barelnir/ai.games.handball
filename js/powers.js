// Special powers. The human team's custom hero (see heroes.js) has one power, set by the chosen
// template (Lightning, Fire, Muscle, Captain). The template's `fx` says what the power does;
// the game asks mod() for multipliers wherever a power can matter (speed, shotSpeed, shotError,
// catchRadius, stealResist, gkReach), and reads fx for the shot itself (unblockable, freezeKeeper,
// keeperSave).
//
// Flow: the meter fills -> POWER -> the carrier passes to the hero (if needed) -> close-up ->
// the ball is powered for `duration` seconds -> a powered shot uses fx, then the ball is normal again.

export const POWERS_ENABLED = true;
export const ENERGY_MAX = 100;
const COST = 100;
const DURATION = 10;
const GAIN = { second: 1.2, goal: 18, save: 14, steal: 12 };

export class PowerSystem {
  constructor(game) {
    this.game = game;
    this.enabled = POWERS_ENABLED;
    this.template = null;
    this.heroName = '';
  }

  configure(template, heroName) {
    this.template = template;
    this.heroName = heroName;
  }

  get fx() { return (this.template && this.template.fx) || {}; }

  // Product of all active effects on this player for a modifier key (1 when none).
  mod(player, key) {
    let m = 1;
    if (!player || !player.effects) return m;
    for (const e of player.effects) if (e.mods && e.mods[key]) m *= e.mods[key];
    return m;
  }

  gain(team, what) {
    team.energy = Math.min(ENERGY_MAX, team.energy + (GAIN[what] || 0));
  }

  update(dt) {
    for (const t of this.game.teams) {
      t.energy = Math.min(ENERGY_MAX, t.energy + GAIN.second * dt);
      for (const p of t.players) {
        if (!p.effects.length) continue;
        for (const e of p.effects) e.t -= dt;
        p.effects = p.effects.filter((e) => e.t > 0);
      }
    }
  }

  // Called when the player presses POWER. Returns true, or the reason it can't fire yet:
  // 'energy' (meter not full), 'ball' (team doesn't have the ball), 'missing' (hero not on court).
  activate(teamIdx) {
    if (!this.enabled || !this.template) return 'off';
    const g = this.game, team = g.teams[teamIdx], b = g.ball;
    if (g.pendingPower || b.power) return true;
    if (team.energy < COST) return 'energy';
    const hero = team.players.find((p) => p.active && p.hero && p.hero.custom);
    if (!hero) return 'missing';
    if (b.owner === hero) { this.start(hero); return true; }
    if (b.owner && b.owner.team === teamIdx && g.state === 'play') {
      g.pass(b.owner, hero);            // the carrier passes to the hero; the power starts on the catch
      if (b.passTo === hero) g.pendingPower = hero;
      return true;
    }
    return 'ball';
  }

  start(hero) {
    const g = this.game, tp = this.template, fx = this.fx, team = g.teams[hero.team];
    team.energy = Math.max(0, team.energy - COST);
    hero.effects = hero.effects.filter((e) => e.id !== 'power');
    hero.effects.push({ id: 'power', t: DURATION, mods: { shotSpeed: fx.speed || 1, shotError: fx.aim || 1 } });
    if (fx.teamSpeed) {
      for (const p of team.players) {
        if (!p.active || p.gk) continue;
        p.effects = p.effects.filter((e) => e.id !== 'rally');
        p.effects.push({ id: 'rally', t: fx.teamTime || 6, mods: { speed: fx.teamSpeed } });
      }
    }
    g.pendingPower = null;
    g.ball.power = tp.ball;
    g.powerT = DURATION;
    g.splash = 1.8;
    g.say(tp.title(this.heroName), tp.sub, 1.9, 'power');
    g.emit({ type: 'power', kind: tp.key, team: hero.team });
  }
}
