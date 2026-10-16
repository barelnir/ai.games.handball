// Tiny synthesized sound effects (no audio files): referee whistle, ball thuds, crowd roar.

export class Sound {
  constructor() { this.ctx = null; this.muted = false; }

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
