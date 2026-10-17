// Shape renderer with two backends that share one API:
//   WebGL 2  – every shape is an instanced quad shaded by a signed-distance function (one draw call per frame)
//   Canvas2D – fallback for browsers/devices without WebGL 2
// All coordinates are in world metres; the camera maps them to pixels.
// Primitives: ellipse, rounded rect, ring, line (capsule) and triangle (optionally rounded).

const KIND_ELLIPSE = 0, KIND_RECT = 1, KIND_RING = 2, KIND_LINE = 3, KIND_TRI = 4;
const FLOATS = 12; // ax ay bx by | r g b a | kind p1 p2 p3

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_a;
layout(location = 1) in vec2 a_b;
layout(location = 2) in vec4 a_col;
layout(location = 3) in vec4 a_prm;
uniform vec2 u_cam;
uniform vec2 u_res;
uniform float u_ppm;
out vec2 v_w;
flat out vec2 v_a;
flat out vec2 v_b;
flat out vec4 v_col;
flat out vec4 v_prm;
void main() {
  int k = int(a_prm.x + 0.5);
  float m = 1.5 / u_ppm;
  vec2 lo, hi;
  if (k == 0) { lo = a_a - a_b; hi = a_a + a_b; }
  else if (k == 1) { float r = length(a_b); lo = a_a - vec2(r); hi = a_a + vec2(r); }
  else if (k == 2) { lo = a_a - a_b - vec2(a_prm.y); hi = a_a + a_b + vec2(a_prm.y); }
  else if (k == 3) { lo = min(a_a, a_b) - vec2(a_prm.y); hi = max(a_a, a_b) + vec2(a_prm.y); }
  else { vec2 c = a_prm.yz; lo = min(min(a_a, a_b), c) - vec2(a_prm.w); hi = max(max(a_a, a_b), c) + vec2(a_prm.w); }
  lo -= vec2(m); hi += vec2(m);
  int vi = gl_VertexID;
  vec2 cr = vec2((vi == 1 || vi == 4 || vi == 5) ? 1.0 : 0.0, (vi == 2 || vi == 3 || vi == 5) ? 1.0 : 0.0);
  vec2 w = mix(lo, hi, cr);
  vec2 p = (w - u_cam) * u_ppm / (u_res * 0.5);
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  v_w = w; v_a = a_a; v_b = a_b; v_col = a_col; v_prm = a_prm;
}`;

const FS = `#version 300 es
precision highp float;
uniform float u_ppm;
in vec2 v_w;
flat in vec2 v_a;
flat in vec2 v_b;
flat in vec4 v_col;
flat in vec4 v_prm;
out vec4 o;
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
void main() {
  int k = int(v_prm.x + 0.5);
  float d;
  if (k == 0) {
    vec2 q = (v_w - v_a) / v_b;
    d = (length(q) - 1.0) * min(v_b.x, v_b.y);
  } else if (k == 1) {
    float cs = cos(v_prm.z), sn = sin(v_prm.z);
    vec2 q0 = v_w - v_a;
    vec2 q = vec2(cs * q0.x + sn * q0.y, -sn * q0.x + cs * q0.y);
    float r = v_prm.y;
    vec2 dd = abs(q) - v_b + vec2(r);
    d = length(max(dd, vec2(0.0))) + min(max(dd.x, dd.y), 0.0) - r;
  } else if (k == 2) {
    vec2 q = (v_w - v_a) / v_b;
    d = abs((length(q) - 1.0) * min(v_b.x, v_b.y)) - v_prm.y;
  } else if (k == 3) {
    vec2 pa = v_w - v_a, ba = v_b - v_a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    d = length(pa - ba * h) - v_prm.y;
  } else {
    d = sdTri(v_w, v_a, v_b, v_prm.yz) - v_prm.w;
  }
  float a = clamp(0.5 - d * u_ppm, 0.0, 1.0) * v_col.a;
  o = vec4(v_col.rgb * a, a);
}`;

// Perspective floor ("TV camera"): every pixel below the horizon looks up the court texture at
// the ground point it sees. Camera: at height u_cam.y (metres) and depth u_cam.z behind the near
// sideline, looking straight across the court with a shifted lens (horizon at u_hor pixels).
const FLOOR_VS = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;
const FLOOR_FS = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec4 u_cam;   // x, height, yPos (camera ground y), f (pixels)
uniform float u_hor;
uniform vec4 u_box;   // texture covers world x0, y0 .. x1, y1
uniform float u_minY; // nothing is drawn beyond this far line (the stands start there)
uniform vec4 u_spot;  // night: spotlight x, y, radius, darkness (0 = day)
uniform vec4 u_bg;
out vec4 o;
void main() {
  float sy = u_res.y - gl_FragCoord.y;
  float den = sy - u_hor;
  if (den <= 0.5) discard;
  float d = u_cam.w * u_cam.y / den;
  float wy = u_cam.z - d;
  if (wy < u_minY) discard;
  float wx = u_cam.x + (gl_FragCoord.x - u_res.x * 0.5) * d / u_cam.w;
  vec2 uv = (vec2(wx, wy) - u_box.xy) / (u_box.zw - u_box.xy);
  vec3 c = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? u_bg.rgb : texture(u_tex, uv).rgb;
  // reflections of the roof lights on the polished floor
  float g = 0.0;
  for (int i = 0; i < 7; i++) {
    vec2 q = (vec2(wx, wy) - vec2(-4.0 + float(i) * 8.0, 7.0)) / vec2(2.2, 6.0);
    g += exp(-dot(q, q));
  }
  c += g * 0.07 * (1.0 - u_spot.w);
  if (u_spot.w > 0.0) {
    vec2 q = (vec2(wx, wy) - u_spot.xy) / u_spot.z;
    float l = exp(-dot(q, q) * 1.6);
    c = c * mix(1.0 - u_spot.w, 1.15, l) + vec3(0.10, 0.09, 0.06) * l;
  }
  o = vec4(c, 1.0);
}`;

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

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

class GLRenderer extends Base {
  constructor(canvas, gl) {
    super(canvas);
    this.kind = 'WebGL 2';
    this.gl = gl;
    this.data = new Float32Array(4096 * FLOATS);
    this.cap = 4096;
    this.init();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.init(); });
  }
  init() {
    const gl = this.gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.uCam = gl.getUniformLocation(prog, 'u_cam');
    this.uRes = gl.getUniformLocation(prog, 'u_res');
    this.uPpm = gl.getUniformLocation(prog, 'u_ppm');
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    this.gpuBytes = this.data.byteLength;
    const stride = FLOATS * 4;
    [[0, 2, 0], [1, 2, 8], [2, 4, 16], [3, 4, 32]].forEach(([loc, size, off]) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(loc, 1);
    });
    gl.bindVertexArray(null);
    const fp = gl.createProgram();
    gl.attachShader(fp, compile(gl, gl.VERTEX_SHADER, FLOOR_VS));
    gl.attachShader(fp, compile(gl, gl.FRAGMENT_SHADER, FLOOR_FS));
    gl.linkProgram(fp);
    this.fprog = fp;
    this.fu = {};
    for (const u of ['u_tex', 'u_res', 'u_cam', 'u_hor', 'u_box', 'u_minY', 'u_spot', 'u_bg']) this.fu[u] = gl.getUniformLocation(fp, u);
    this.fvao = gl.createVertexArray();
    this.tex = null;
    if (this.floorSrc) this.setFloor(this.floorSrc.canvas, this.floorSrc.box);
  }
  // The court texture for the TV camera (a top-down drawing of the floor).
  setFloor(canvas, box) {
    const gl = this.gl;
    this.floorSrc = { canvas, box };
    if (this.lost) return;
    if (!this.tex) this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  // Draw the perspective floor this frame (under every shape). cam: { x, height, yPos, f, hor, minY, spot }
  floor(cam) { this.floorCam = cam; }
  begin(cx, cy, ppm, clear) {
    this.setView(cx, cy, ppm);
    this.n = 0;
    this.clear = clear;
    this.floorCam = null;
  }
  push(ax, ay, bx, by, c, kind, p1, p2, p3 = 0) {
    if (this.n >= this.cap) {
      const old = this.data;
      this.cap *= 2;
      this.data = new Float32Array(this.cap * FLOATS);
      this.data.set(old);
    }
    const d = this.data, o = this.n++ * FLOATS;
    d[o] = ax; d[o + 1] = ay; d[o + 2] = bx; d[o + 3] = by;
    d[o + 4] = c[0]; d[o + 5] = c[1]; d[o + 6] = c[2]; d[o + 7] = c[3];
    d[o + 8] = kind; d[o + 9] = p1; d[o + 10] = p2; d[o + 11] = p3;
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
  tri(x1, y1, x2, y2, x3, y3, c, round = 0) {
    if (!this.visible(Math.min(x1, x2, x3) - round, Math.min(y1, y2, y3) - round, Math.max(x1, x2, x3) + round, Math.max(y1, y2, y3) + round)) return;
    this.push(x1, y1, x2, y2, c, KIND_TRI, x3, y3, round);
  }
  end() {
    const gl = this.gl;
    if (this.lost) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const c = this.clear;
    gl.clearColor(c[0], c[1], c[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const fc = this.floorCam;
    if (fc && this.tex) {
      const b = this.floorSrc.box, u = this.fu, sp = fc.spot || [0, 0, 1, 0];
      gl.disable(gl.BLEND);
      gl.useProgram(this.fprog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(u.u_tex, 0);
      gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
      gl.uniform4f(u.u_cam, fc.x, fc.height, fc.yPos, fc.f);
      gl.uniform1f(u.u_hor, fc.hor);
      gl.uniform4f(u.u_box, b[0], b[1], b[2], b[3]);
      gl.uniform1f(u.u_minY, fc.minY);
      gl.uniform4f(u.u_spot, sp[0], sp[1], sp[2], sp[3]);
      gl.uniform4f(u.u_bg, c[0], c[1], c[2], 1);
      gl.bindVertexArray(this.fvao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }
    if (!this.n) return;
    gl.useProgram(this.prog);
    gl.uniform2f(this.uCam, this.cam.x, this.cam.y);
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uPpm, this.cam.ppm);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    if (this.data.byteLength > this.gpuBytes) {
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      this.gpuBytes = this.data.byteLength;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * FLOATS);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.n);
    gl.bindVertexArray(null);
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
    g.lineJoin = 'round';
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
  tri(x1, y1, x2, y2, x3, y3, c, round = 0) {
    if (!this.visible(Math.min(x1, x2, x3) - round, Math.min(y1, y2, y3) - round, Math.max(x1, x2, x3) + round, Math.max(y1, y2, y3) + round)) return;
    const g = this.g;
    g.fillStyle = css(c);
    g.beginPath();
    g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath();
    g.fill();
    if (round > 0) { g.strokeStyle = css(c); g.lineWidth = round * 2; g.stroke(); }
  }
  setFloor(canvas, box) { this.floorSrc = { canvas, box }; }
  // Canvas fallback for the perspective floor: one source row per screen row.
  floor(cam) {
    const src = this.floorSrc;
    if (!src) return;
    const g = this.g, [x0, y0, x1, y1] = src.box, cv = src.canvas;
    const kx = cv.width / (x1 - x0), ky = cv.height / (y1 - y0), w = this.canvas.width, h = this.canvas.height;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let sy = Math.max(0, Math.ceil(cam.hor + 1)); sy < h; sy += 2) {
      const d = (cam.f * cam.height) / (sy + 1 - cam.hor), wy = cam.yPos - d;
      if (wy < cam.minY) continue;
      const xL = cam.x - (w / 2) * d / cam.f, xR = cam.x + (w / 2) * d / cam.f;
      const sx = (xL - x0) * kx, sw = (xR - xL) * kx;
      g.drawImage(cv, sx, Math.max(0, Math.min(cv.height - 1, (wy - y0) * ky)), sw, 1, 0, sy, w, 2);
    }
    const sp = cam.spot;
    if (sp && sp[3] > 0) { g.fillStyle = `rgba(4,6,24,${sp[3] * 0.8})`; g.fillRect(0, Math.max(0, cam.hor), w, h); }
    g.restore();
  }
  end() {}
}

export function createRenderer(canvas, { preferGL = true } = {}) {
  if (preferGL) {
    try {
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
      if (gl) return new GLRenderer(canvas, gl);
    } catch (e) {
      console.warn('WebGL 2 unavailable, using Canvas 2D', e);
    }
  }
  // A canvas that already has a webgl context cannot give out a 2d one, so swap it.
  let c = canvas;
  if (!c.getContext('2d', { alpha: false })) {
    c = canvas.cloneNode(false);
    canvas.replaceWith(c);
  }
  return new CanvasRenderer(c);
}
