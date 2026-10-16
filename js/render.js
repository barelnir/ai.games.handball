// Shape renderer with two backends that share one API:
//   WebGPU  – every shape is an instanced quad shaded by a signed-distance function (one draw call per frame)
//   Canvas2D – fallback for browsers/devices without WebGPU
// All coordinates are in world metres; the camera maps them to pixels.

const KIND_ELLIPSE = 0, KIND_RECT = 1, KIND_RING = 2, KIND_LINE = 3;
const FLOATS = 12; // ax ay bx by | r g b a | kind p1 p2 p3

const WGSL = /* wgsl */ `
struct Uni { cam: vec2f, res: vec2f, ppm: f32 };
@group(0) @binding(0) var<uniform> u: Uni;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) w: vec2f,
  @location(1) a: vec2f,
  @location(2) b: vec2f,
  @location(3) col: vec4f,
  @location(4) prm: vec4f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32,
      @location(0) a: vec2f, @location(1) b: vec2f,
      @location(2) col: vec4f, @location(3) prm: vec4f) -> VOut {
  let k = i32(round(prm.x));
  let m = 1.5 / u.ppm;
  var lo: vec2f; var hi: vec2f;
  if (k == 0) { lo = a - b; hi = a + b; }
  else if (k == 1) { let r = length(b); lo = a - vec2f(r); hi = a + vec2f(r); }
  else if (k == 2) { lo = a - b - vec2f(prm.y); hi = a + b + vec2f(prm.y); }
  else { lo = min(a, b) - vec2f(prm.y); hi = max(a, b) + vec2f(prm.y); }
  lo -= vec2f(m); hi += vec2f(m);
  var corners = array<vec2f, 6>(vec2f(0,0), vec2f(1,0), vec2f(0,1), vec2f(0,1), vec2f(1,0), vec2f(1,1));
  let c = corners[vi];
  let w = mix(lo, hi, c);
  let p = (w - u.cam) * u.ppm / (u.res * 0.5);
  var o: VOut;
  o.pos = vec4f(p.x, -p.y, 0.0, 1.0);
  o.w = w; o.a = a; o.b = b; o.col = col; o.prm = prm;
  return o;
}

@fragment
fn fs(i: VOut) -> @location(0) vec4f {
  let k = i32(round(i.prm.x));
  var d: f32;
  if (k == 0) {
    let q = (i.w - i.a) / i.b;
    d = (length(q) - 1.0) * min(i.b.x, i.b.y);
  } else if (k == 1) {
    let cs = cos(i.prm.z); let sn = sin(i.prm.z);
    let q0 = i.w - i.a;
    let q = vec2f(cs * q0.x + sn * q0.y, -sn * q0.x + cs * q0.y);
    let r = i.prm.y;
    let dd = abs(q) - i.b + vec2f(r);
    d = length(max(dd, vec2f(0.0))) + min(max(dd.x, dd.y), 0.0) - r;
  } else if (k == 2) {
    let q = (i.w - i.a) / i.b;
    d = abs((length(q) - 1.0) * min(i.b.x, i.b.y)) - i.prm.y;
  } else {
    let pa = i.w - i.a; let ba = i.b - i.a;
    let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    d = length(pa - ba * h) - i.prm.y;
  }
  let alpha = clamp(0.5 - d * u.ppm, 0.0, 1.0) * i.col.a;
  return vec4f(i.col.rgb * alpha, alpha);
}
`;

class Base {
  constructor(canvas) {
    this.canvas = canvas;
    this.cam = { x: 0, y: 0, ppm: 30 };
    this.view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  }
  setView(cx, cy, ppm) {
    this.cam.x = cx; this.cam.y = cy; this.cam.ppm = ppm;
    const hw = this.canvas.width / 2 / ppm, hh = this.canvas.height / 2 / ppm;
    this.view.x0 = cx - hw; this.view.x1 = cx + hw;
    this.view.y0 = cy - hh; this.view.y1 = cy + hh;
  }
  visible(x0, y0, x1, y1) {
    const v = this.view;
    return x1 >= v.x0 && x0 <= v.x1 && y1 >= v.y0 && y0 <= v.y1;
  }
}

class GPURenderer extends Base {
  constructor(canvas, device, ctx, format) {
    super(canvas);
    this.kind = 'WebGPU';
    this.device = device; this.ctx = ctx; this.format = format;
    const module = device.createShaderModule({ code: WGSL });
    this.module = module;
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module, entryPoint: 'vs',
        buffers: [{
          arrayStride: FLOATS * 4, stepMode: 'instance',
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' },
            { shaderLocation: 2, offset: 16, format: 'float32x4' },
            { shaderLocation: 3, offset: 32, format: 'float32x4' },
          ],
        }],
      },
      fragment: {
        module, entryPoint: 'fs',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
    this.uni = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bind = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uni } }],
    });
    this.uniData = new Float32Array(8);
    this.alloc(4096);
  }
  alloc(cap) {
    this.cap = cap;
    this.data = new Float32Array(cap * FLOATS);
    if (this.buf) this.buf.destroy();
    this.buf = this.device.createBuffer({ size: this.data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  }
  begin(cx, cy, ppm, clear) {
    this.setView(cx, cy, ppm);
    this.n = 0;
    this.clear = clear;
  }
  push(ax, ay, bx, by, c, kind, p1, p2) {
    if (this.n >= this.cap) {
      const old = this.data;
      this.alloc(this.cap * 2);
      this.data.set(old);
    }
    const d = this.data, o = this.n++ * FLOATS;
    d[o] = ax; d[o + 1] = ay; d[o + 2] = bx; d[o + 3] = by;
    d[o + 4] = c[0]; d[o + 5] = c[1]; d[o + 6] = c[2]; d[o + 7] = c[3];
    d[o + 8] = kind; d[o + 9] = p1; d[o + 10] = p2; d[o + 11] = 0;
  }
  ellipse(x, y, rx, ry, c) {
    if (!this.visible(x - rx, y - ry, x + rx, y + ry)) return;
    this.push(x, y, rx, ry, c, KIND_ELLIPSE, 0, 0);
  }
  rect(x, y, hw, hh, c, rot = 0, rad = 0) {
    const r = rot ? Math.hypot(hw, hh) : 0;
    if (!this.visible(x - (r || hw), y - (r || hh), x + (r || hw), y + (r || hh))) return;
    this.push(x, y, hw, hh, c, KIND_RECT, Math.min(rad, hw, hh), rot);
  }
  ring(x, y, rx, ry, th, c) {
    if (!this.visible(x - rx - th, y - ry - th, x + rx + th, y + ry + th)) return;
    this.push(x, y, rx, ry, c, KIND_RING, th, 0);
  }
  line(x1, y1, x2, y2, hw, c) {
    if (!this.visible(Math.min(x1, x2) - hw, Math.min(y1, y2) - hw, Math.max(x1, x2) + hw, Math.max(y1, y2) + hw)) return;
    this.push(x1, y1, x2, y2, c, KIND_LINE, hw, 0);
  }
  end() {
    const { device } = this;
    const u = this.uniData;
    u[0] = this.cam.x; u[1] = this.cam.y; u[2] = this.canvas.width; u[3] = this.canvas.height; u[4] = this.cam.ppm;
    device.queue.writeBuffer(this.uni, 0, u);
    if (this.n) device.queue.writeBuffer(this.buf, 0, this.data, 0, this.n * FLOATS);
    const enc = device.createCommandEncoder();
    const c = this.clear;
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: this.ctx.getCurrentTexture().createView(),
        clearValue: { r: c[0], g: c[1], b: c[2], a: 1 },
        loadOp: 'clear', storeOp: 'store',
      }],
    });
    if (this.n) {
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bind);
      pass.setVertexBuffer(0, this.buf);
      pass.draw(6, this.n);
    }
    pass.end();
    device.queue.submit([enc.finish()]);
  }
}

const cssCache = new WeakMap();
function css(c) {
  let s = cssCache.get(c);
  if (!s) {
    s = `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${c[3]})`;
    cssCache.set(c, s);
  }
  return s;
}

class CanvasRenderer extends Base {
  constructor(canvas) {
    super(canvas);
    this.kind = 'Canvas 2D';
    this.g = canvas.getContext('2d', { alpha: false });
  }
  begin(cx, cy, ppm, clear) {
    this.setView(cx, cy, ppm);
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = css(clear);
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(ppm, 0, 0, ppm, this.canvas.width / 2 - cx * ppm, this.canvas.height / 2 - cy * ppm);
    g.lineCap = 'round';
  }
  ellipse(x, y, rx, ry, c) {
    if (!this.visible(x - rx, y - ry, x + rx, y + ry)) return;
    const g = this.g;
    g.fillStyle = css(c);
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  rect(x, y, hw, hh, c, rot = 0, rad = 0) {
    const r = rot ? Math.hypot(hw, hh) : 0;
    if (!this.visible(x - (r || hw), y - (r || hh), x + (r || hw), y + (r || hh))) return;
    const g = this.g;
    g.fillStyle = css(c);
    if (!rot && !rad) { g.fillRect(x - hw, y - hh, hw * 2, hh * 2); return; }
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.beginPath();
    if (g.roundRect) g.roundRect(-hw, -hh, hw * 2, hh * 2, Math.min(rad, hw, hh));
    else g.rect(-hw, -hh, hw * 2, hh * 2);
    g.fill();
    g.restore();
  }
  ring(x, y, rx, ry, th, c) {
    if (!this.visible(x - rx - th, y - ry - th, x + rx + th, y + ry + th)) return;
    const g = this.g;
    g.strokeStyle = css(c);
    g.lineWidth = th * 2;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
  }
  line(x1, y1, x2, y2, hw, c) {
    if (!this.visible(Math.min(x1, x2) - hw, Math.min(y1, y2) - hw, Math.max(x1, x2) + hw, Math.max(y1, y2) + hw)) return;
    const g = this.g;
    g.strokeStyle = css(c);
    g.lineWidth = hw * 2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  end() {}
}

export async function createRenderer(canvas, { preferGPU = true, onLost } = {}) {
  if (preferGPU && typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const device = await adapter.requestDevice();
        const ctx = canvas.getContext('webgpu');
        if (ctx) {
          const format = navigator.gpu.getPreferredCanvasFormat();
          ctx.configure({ device, format, alphaMode: 'opaque' });
          const r = new GPURenderer(canvas, device, ctx, format);
          const info = r.module.getCompilationInfo ? await r.module.getCompilationInfo() : null;
          if (info && info.messages.some((m) => m.type === 'error')) {
            console.warn('WGSL errors', info.messages);
          } else {
            device.lost.then((e) => { if (e.reason !== 'destroyed' && onLost) onLost(e); });
            return r;
          }
        }
      }
    } catch (e) {
      console.warn('WebGPU unavailable, using Canvas 2D', e);
    }
  }
  // A canvas that already has a webgpu context cannot give out a 2d one, so swap it.
  let c = canvas;
  const ctx2d = c.getContext('2d', { alpha: false });
  if (!ctx2d) {
    c = canvas.cloneNode(false);
    canvas.replaceWith(c);
  }
  return new CanvasRenderer(c);
}
