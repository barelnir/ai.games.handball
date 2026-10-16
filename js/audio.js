// Synthesized audio (no audio files): referee whistle, ball thuds, crowd roar,
// and a looping arena-style music track made by a small step sequencer.

const BPM = 116;
const STEP = 60 / BPM / 4; // one 16th note
// I–V–vi–IV in C: C, G, Am, F (bass roots as MIDI notes)
const ROOTS = [36, 43, 45, 41, 36, 43, 45, 41];
const CHORDS = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]];
// Lead melody, one entry per 8th note (8 per bar), null = rest
const LEAD = [
  76, null, 79, null, 84, 79, 76, null,
  74, null, 79, null, 83, 79, 74, null,
  72, null, 76, null, 81, 76, 72, 74,
  77, 76, 74, 72, 74, null, 72, null,
  76, 76, 79, 76, 84, null, 83, null,
  83, null, 79, null, 74, 76, 79, null,
  81, null, 79, 76, 72, null, 76, null,
  77, null, 76, null, 74, null, 72, null,
];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.musicOn = true; this.timer = null; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
    if (this.musicOn) this.startMusic();
  }

  // ---------------------------------------------------------------- music
  setMusic(on) {
    this.musicOn = on;
    if (on) this.startMusic(); else this.stopMusic();
  }

  startMusic() {
    if (!this.ctx || this.timer) return;
    const c = this.ctx;
    this.mus = c.createGain();
    this.mus.gain.value = 0.0001;
    this.mus.gain.exponentialRampToValueAtTime(0.32, c.currentTime + 1.2);
    this.mus.connect(this.master);
    this.step = 0;
    this.loop = 0;
    this.next = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const g = this.mus, t = this.ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    setTimeout(() => g.disconnect(), 600);
  }

  schedule() {
    const c = this.ctx;
    if (c.state !== 'running') { this.next = c.currentTime + 0.1; return; }
    while (this.next < c.currentTime + 0.15) {
      this.playStep(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % 128;
      if (this.step === 0) this.loop++;
    }
  }

  playStep(i, t) {
    const bar = i >> 4, s = i & 15, out = this.mus;
    // drums
    if (s === 0 || s === 8 || (s === 10 && bar % 2)) this.kick(t, out);
    if (s === 4 || s === 12) this.snare(t, out);
    if (s % 2 === 0) this.hat(t, out, s % 4 === 2 ? 0.09 : 0.05);
    if (bar === 7 && s >= 12) this.snare(t, out, 0.5);
    // bass
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.tone(t, hz(ROOTS[bar] + (s === 6 || s === 14 ? 12 : 0)), STEP * 1.6, 'sawtooth', 0.16, out, 520);
    // chord stabs on the off-beats
    if (s === 2 || s === 6 || s === 10 || s === 14) {
      for (const n of CHORDS[bar % 4]) this.tone(t, hz(n), STEP * 0.9, 'square', 0.025, out, 1800);
    }
    // lead melody every other loop, so it doesn't wear out
    if (this.loop % 2 === 0 && s % 2 === 0) {
      const n = LEAD[bar * 8 + s / 2];
      if (n) this.tone(t, hz(n), STEP * 1.7, 'triangle', 0.11, out, 4000);
    }
  }

  tone(t, f, dur, type, vol, out, cutoff) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(fl); fl.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  kick(t, out) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.24);
  }

  snare(t, out, vol = 0.32) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    n.connect(f); f.connect(g); g.connect(out);
    n.start(t, Math.random()); n.stop(t + 0.15);
  }

  hat(t, out, vol) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    n.connect(f); f.connect(g); g.connect(out);
    n.start(t, Math.random()); n.stop(t + 0.05);
  }

  ok() { return this.ctx && !this.muted && this.ctx.state === 'running'; }

  whistle(n = 1, short = false) {
    if (!this.ok()) return;
    const c = this.ctx, t0 = c.currentTime;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.32, dur = short ? 0.16 : n > 1 && i === n - 1 ? 0.6 : 0.26;
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'square'; o.frequency.value = 2650;
      lfo.frequency.value = 38; lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2700; f.Q.value = 3;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.04);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
    }
  }

  thud(vol = 0.4, freq = 140) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.15);
  }

  crowd(vol = 0.35, dur = 2.2) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur);
  }
}
