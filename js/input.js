// Keyboard + touch controls. Produces { mx, my, aPress, bDown, bPress, bRelease, pPress }.
//   Move:  WASD / arrows, or the arrow pad (touch anywhere on the left half)
//   A:     J / Z  – pass (attack) · switch player (defence)
//   B:     K / X  – hold to wind up a jump shot, release to shoot (attack) · steal / block (defence)
//   Power: L / C / Space – special power (slot reserved)

export class Input {
  constructor(root) {
    this.state = { mx: 0, my: 0, aPress: false, bDown: false, bPress: false, bRelease: false, pPress: false };
    this.keys = new Set();
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.touchUsed = false;
    this.onPause = null;
    this.root = root;
    this.base = root.querySelector('#stick');
    this.knob = root.querySelector('#knob');
    this.bindKeys();
    this.bindTouch();
  }

  bindKeys() {
    const A = ['KeyJ', 'KeyZ'], B = ['KeyK', 'KeyX'], P = ['KeyL', 'KeyC', 'Space'];
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { this.onPause && this.onPause(); return; }
      if (e.repeat) return;
      this.keys.add(e.code);
      if (A.includes(e.code)) this.state.aPress = true;
      if (B.includes(e.code)) { this.state.bPress = true; }
      if (P.includes(e.code)) this.state.pPress = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (B.includes(e.code)) this.state.bRelease = true;
    });
    addEventListener('blur', () => this.keys.clear());
  }

  bindTouch() {
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') document.body.classList.add('touch');
    }, true);
    // Fixed arrow pad at bottom-left. A touch near the pad steers from its centre;
    // a touch elsewhere on the left half steers from where the thumb landed.
    const zone = this.root.querySelector('#stickZone');
    const R = 46;
    this.arrows = {};
    for (const d of ['up', 'right', 'down', 'left']) this.arrows[d] = this.base.querySelector('.arr.' + d);
    const showKnob = () => {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
      const k = d > R ? R / d : 1;
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      const on = d > 10;
      this.arrows.right.classList.toggle('on', on && dx > d * 0.38);
      this.arrows.left.classList.toggle('on', on && dx < -d * 0.38);
      this.arrows.down.classList.toggle('on', on && dy > d * 0.38);
      this.arrows.up.classList.toggle('on', on && dy < -d * 0.38);
    };
    zone.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== null) return;
      this.touchUsed = true;
      zone.setPointerCapture(e.pointerId);
      this.stick.id = e.pointerId;
      const r = this.base.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const near = Math.hypot(e.clientX - cx, e.clientY - cy) < r.width;
      this.stick.ox = near ? cx : e.clientX;
      this.stick.oy = near ? cy : e.clientY;
      this.stick.x = e.clientX; this.stick.y = e.clientY;
      showKnob();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.x = e.clientX; this.stick.y = e.clientY;
      showKnob();
    });
    const up = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = null;
      this.stick.x = this.stick.ox; this.stick.y = this.stick.oy;
      showKnob();
    };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);

    const btn = (sel, down, release) => {
      const el = this.root.querySelector(sel);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.touchUsed = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add('down');
        down();
        if (navigator.vibrate) try { navigator.vibrate(8); } catch {}
      });
      const end = () => { el.classList.remove('down'); release && release(); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };
    btn('#btnA', () => { this.state.aPress = true; });
    btn('#btnB', () => { this.state.bPress = true; this.touchB = true; }, () => { this.touchB = false; this.state.bRelease = true; });
    btn('#btnP', () => { this.state.pPress = true; });
  }

  read() {
    const k = this.keys, s = this.state;
    let mx = 0, my = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (this.stick.id !== null) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
      if (d > 8) { const f = Math.min(1, d / 46); mx = (dx / d) * f; my = (dy / d) * f; }
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    s.mx = mx; s.my = my;
    s.bDown = k.has('KeyK') || k.has('KeyX') || !!this.touchB;
    return s;
  }

  // Called after the game consumed the edge-triggered presses.
  clearEdges() {
    const s = this.state;
    s.aPress = s.bPress = s.bRelease = s.pPress = false;
  }
}
