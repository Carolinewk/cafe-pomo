// A tiny colored-pencil renderer.
// Drawings are authored in a 200 x 200 logical space and rendered at any pixel size.
// Lines are wobbly tapered ribbons, fills are hatched strokes, and every layer is
// masked by a paper-tooth texture so pigment skips the paper's valleys.

import { mulberry32, noise1, tileNoise2, clamp } from './rng.js';

export const ART = 200;
const TAU = Math.PI * 2;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ---------------------------------------------------------------- shapes

/** A polyline (or polygon, once closed) in logical units. */
export class Path {
  constructor(x, y) {
    this.pts = [[x, y]];
    this.closed = false;
  }
  get last() {
    return this.pts[this.pts.length - 1];
  }
  line(x, y) {
    const [x0, y0] = this.last;
    const n = Math.max(2, Math.ceil(Math.hypot(x - x0, y - y0) / 2));
    for (let i = 1; i <= n; i++) this.pts.push([x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n]);
    return this;
  }
  quad(cx, cy, x, y) {
    const [x0, y0] = this.last;
    const n = Math.max(4, Math.ceil((Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy)) / 2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      this.pts.push([u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y]);
    }
    return this;
  }
  cubic(c1x, c1y, c2x, c2y, x, y) {
    const [x0, y0] = this.last;
    const approx = Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x - c2x, y - c2y);
    const n = Math.max(6, Math.ceil(approx / 2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      this.pts.push([
        u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
        u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
      ]);
    }
    return this;
  }
  /** Append an elliptical arc from angle a0 to a1 (radians, screen space: +y is down). */
  arc(cx, cy, rx, ry, a0, a1) {
    const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * Math.max(rx, ry)) / 2));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return this;
  }
  close() {
    this.closed = true;
    return this;
  }
  /** A translated copy, used for the slightly mis-registered color fills. */
  shift(dx, dy) {
    const p = new Path(0, 0);
    p.pts = this.pts.map(([x, y]) => [x + dx, y + dy]);
    p.closed = this.closed;
    return p;
  }
  static ellipse(cx, cy, rx, ry, rot = 0) {
    const n = Math.max(24, Math.ceil((TAU * Math.max(rx, ry)) / 2));
    const p = new Path(0, 0);
    p.pts = [];
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      p.pts.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return p.close();
  }
  static poly(points) {
    const p = new Path(...points[0]);
    for (let i = 1; i < points.length; i++) p.line(...points[i]);
    return p.close();
  }
  /** A smooth curve through every point (Catmull-Rom), optionally closed. */
  static through(points, closed = false) {
    const n = points.length;
    const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
    const p = new Path(...points[0]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      p.cubic(
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1],
      );
    }
    if (closed) p.close();
    return p;
  }
  /** A closed band around a center line, `w` units wide (used for handles and straws). */
  static ribbon(center, w, w2 = w) {
    const pts = resample(center.pts, 1.5);
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
      const [nx, ny] = normalAt(pts, i);
      const t = i / (pts.length - 1);
      const hw = (w + (w2 - w) * t) / 2;
      left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
      right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
    }
    const p = new Path(0, 0);
    p.pts = left.concat(right.reverse());
    return p.close();
  }
}

/** A shape made of several loops filled with the even-odd rule (e.g. a ring). */
export class Shape {
  constructor(...paths) {
    this.loops = paths.map((p) => p.pts);
  }
}

const loopsOf = (shape) => (shape instanceof Shape ? shape.loops : [shape.pts]);

function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  const end = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(end[0] - tail[0], end[1] - tail[1]) > step * 0.3) out.push(end);
  return out;
}

function normalAt(pts, i) {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

function bounds(loops) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const loop of loops) {
    for (const [x, y] of loop) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

// ---------------------------------------------------------------- paper

const grainCache = new Map();

/**
 * Paper tooth as an alpha texture. `lo`/`hi` choose how much of the tooth catches
 * pigment: light pressure (high lo) leaves more white specks.
 */
function grainTexture(kind) {
  if (grainCache.has(kind)) return grainCache.get(kind);
  const size = 240;
  const rand = mulberry32(kind === 'soft' ? 7 : kind === 'hard' ? 11 : 13);
  const fine = tileNoise2(rand, 80);
  const mid = tileNoise2(rand, 30);
  const big = tileNoise2(rand, 8);
  const [lo, hi] = kind === 'soft' ? [0.18, 0.62] : kind === 'hard' ? [0.02, 0.4] : [0.3, 0.7];
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Paper fibres run mostly horizontally: stretch the fine noise along x.
      const v =
        0.42 * fine((x / 3) * 0.75, y / 3) +
        0.28 * mid((x / 8) * 0.8, y / 8) +
        0.12 * big(x / 30, y / 30) +
        0.18 * rand();
      const a = clamp((v - lo) / (hi - lo), 0, 1);
      const i = (y * size + x) * 4;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  grainCache.set(kind, c);
  return c;
}

// ---------------------------------------------------------------- sketch

export class Sketch {
  /**
   * @param {number} px output size in device pixels (square)
   * @param {number} seed deterministic seed so the drawing never "boils"
   */
  constructor(px, seed = 1) {
    this.px = Math.round(px);
    this.k = this.px / ART;
    this.canvas = makeCanvas(this.px, this.px);
    this.ctx = this.canvas.getContext('2d');
    this.layer = makeCanvas(this.px, this.px);
    this.lc = this.layer.getContext('2d');
    this.rand = mulberry32(seed);
    this.patterns = {};
  }

  r(a = 0, b = 1) {
    return a + (b - a) * this.rand();
  }

  pattern(kind) {
    if (!this.patterns[kind]) this.patterns[kind] = this.lc.createPattern(grainTexture(kind), 'repeat');
    return this.patterns[kind];
  }

  /** Start a fresh working layer, optionally clipped to a shape. */
  begin(clip = null) {
    const { lc } = this;
    if (this.clipped) {
      lc.restore();
      this.clipped = false;
    }
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = 1;
    lc.clearRect(0, 0, this.px, this.px);
    lc.setTransform(this.k, 0, 0, this.k, 0, 0);
    lc.lineCap = 'round';
    lc.lineJoin = 'round';
    if (clip) {
      lc.save();
      this.clipped = true;
      lc.beginPath();
      for (const loop of loopsOf(clip)) {
        lc.moveTo(loop[0][0], loop[0][1]);
        for (let i = 1; i < loop.length; i++) lc.lineTo(loop[i][0], loop[i][1]);
        lc.closePath();
      }
      lc.clip('evenodd');
    }
    return lc;
  }

  /**
   * Composite the working layer onto the drawing.
   * mask: { from:[x,y], to:[x,y], stops:[[t, alpha], ...] } linear, or { center:[x,y], r0, r1, stops } radial.
   */
  flush({ grain = 'soft', alpha = 1, mask = null, blend = 'source-over' } = {}) {
    const { lc, ctx, k } = this;
    if (this.clipped) {
      lc.restore();
      this.clipped = false;
    }
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalAlpha = 1;
    if (mask) {
      let grad;
      if (mask.center) {
        const [cx, cy] = mask.center;
        grad = lc.createRadialGradient(cx * k, cy * k, (mask.r0 || 0) * k, cx * k, cy * k, mask.r1 * k);
      } else {
        grad = lc.createLinearGradient(mask.from[0] * k, mask.from[1] * k, mask.to[0] * k, mask.to[1] * k);
      }
      for (const [t, a] of mask.stops) grad.addColorStop(t, `rgba(0,0,0,${a})`);
      lc.globalCompositeOperation = 'destination-in';
      lc.fillStyle = grad;
      lc.fillRect(0, 0, this.px, this.px);
    }
    if (grain) {
      lc.globalCompositeOperation = 'destination-in';
      lc.fillStyle = this.pattern(grain);
      lc.fillRect(0, 0, this.px, this.px);
    }
    lc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = blend;
    ctx.drawImage(this.layer, 0, 0);
    ctx.restore();
  }

  // ------------------------------------------------------------ fills

  /** Remove everything already drawn under a shape, so solid objects hide what is behind them. */
  erase(shape, { grow = 0.4 } = {}) {
    const { ctx, k } = this;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    for (const loop of loopsOf(shape)) {
      ctx.moveTo(loop[0][0], loop[0][1]);
      for (let i = 1; i < loop.length; i++) ctx.lineTo(loop[i][0], loop[i][1]);
      ctx.closePath();
    }
    ctx.fill('evenodd');
    if (grow > 0) {
      ctx.lineWidth = grow * 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Graphite-only rendering for drinks that are still locked in the shop. */
  tone(color, alpha, kind) {
    if (!this.mono) return [color, alpha];
    if (kind === 'line') return [color === '#ffffff' ? color : '#5d5650', alpha * 0.85];
    if (color === '#ffffff') return [color, alpha];
    return ['#8f8780', alpha * (kind === 'wash' ? 0.22 : 0.55)];
  }

  /** Even, lightly textured layer of color (a gentle first pass of pencil). */
  wash(shape, color, { alpha = 0.55, grain = 'soft', mask = null, offset = null, clip = null } = {}) {
    [color, alpha] = this.tone(color, alpha, 'wash');
    const lc = this.begin(clip);
    const off = offset || [this.r(-0.8, 0.8), this.r(-0.6, 0.6)];
    lc.fillStyle = color;
    lc.beginPath();
    for (const loop of loopsOf(shape)) {
      lc.moveTo(loop[0][0] + off[0], loop[0][1] + off[1]);
      for (let i = 1; i < loop.length; i++) lc.lineTo(loop[i][0] + off[0], loop[i][1] + off[1]);
      lc.closePath();
    }
    lc.fill('evenodd');
    this.flush({ grain, alpha, mask });
  }

  /**
   * Hatched strokes inside a shape. Lines are clipped analytically against the
   * shape so their ends land unevenly near the edge, as real coloring does.
   */
  hatch(shape, color, opts = {}) {
    const {
      angle = -1.05,
      spacing = 1.7,
      width = 0.85,
      alpha = 0.6,
      jitter = 0.35,
      inset = 1.4,
      overshoot = 0.9,
      bend = 0.5,
      grain = 'soft',
      mask = null,
      offset = null,
      cross = 0,
      clip = null,
    } = opts;
    let { layerAlpha = 1 } = opts;
    [color, layerAlpha] = this.tone(color, layerAlpha, 'hatch');
    const lc = this.begin(clip);
    lc.strokeStyle = color;
    const off = offset || [this.r(-0.7, 0.7), this.r(-0.5, 0.5)];
    const loops = loopsOf(shape).map((l) => l.map(([x, y]) => [x + off[0], y + off[1]]));
    const angles = cross ? [angle, angle + cross] : [angle];
    for (const a of angles) this.#hatchPass(lc, loops, a, spacing, width, alpha, jitter, inset, overshoot, bend);
    this.flush({ grain, alpha: layerAlpha, mask });
  }

  #hatchPass(lc, loops, angle, spacing, width, alpha, jitter, inset, overshoot, bend) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const b = bounds(loops);
    const corners = [
      [b.x0, b.y0],
      [b.x1, b.y0],
      [b.x0, b.y1],
      [b.x1, b.y1],
    ];
    let nMin = Infinity;
    let nMax = -Infinity;
    for (const [x, y] of corners) {
      const n = x * nx + y * ny;
      nMin = Math.min(nMin, n);
      nMax = Math.max(nMax, n);
    }
    const edges = [];
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) edges.push([loop[i], loop[(i + 1) % loop.length]]);
    }
    // Bucket strokes by alpha so we issue few stroke() calls.
    const buckets = [[], [], []];
    for (let o = nMin + this.r(0, spacing); o < nMax; o += spacing * this.r(1 - jitter, 1 + jitter)) {
      const ox = nx * o;
      const oy = ny * o;
      // Intersections of the line p = (ox, oy) + t * d with every edge.
      const ts = [];
      for (const [p, q] of edges) {
        const ex = q[0] - p[0];
        const ey = q[1] - p[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const wx = p[0] - ox;
        const wy = p[1] - oy;
        const t = (wx * ey - wy * ex) / den;
        const s = (wx * dy - wy * dx) / den;
        if (s >= 0 && s < 1) ts.push(t);
      }
      ts.sort((m, n) => m - n);
      for (let i = 0; i + 1 < ts.length; i += 2) {
        const t0 = ts[i] + this.r(-overshoot, inset);
        const t1 = ts[i + 1] - this.r(-overshoot, inset);
        if (t1 - t0 < 0.8) continue;
        const ax = ox + dx * t0;
        const ay = oy + dy * t0;
        const bx = ox + dx * t1;
        const by = oy + dy * t1;
        const bendAmt = this.r(-bend, bend);
        const cx = (ax + bx) / 2 + nx * bendAmt;
        const cy = (ay + by) / 2 + ny * bendAmt;
        buckets[Math.floor(this.r(0, 3))].push([ax, ay, cx, cy, bx, by]);
      }
    }
    buckets.forEach((lines, bi) => {
      if (!lines.length) return;
      lc.globalAlpha = alpha * [0.55, 0.8, 1][bi];
      lc.lineWidth = width * [0.8, 1, 1.15][bi];
      lc.beginPath();
      for (const [ax, ay, cx, cy, bx, by] of lines) {
        lc.moveTo(ax, ay);
        lc.quadraticCurveTo(cx, cy, bx, by);
      }
      lc.stroke();
    });
    lc.globalAlpha = 1;
  }

  // ------------------------------------------------------------ lines

  /**
   * A pencil line along a path: tapered, slightly wobbly, drawn in a couple of
   * passes that never quite coincide. Closed paths start anywhere and overlap.
   */
  line(path, color, opts = {}) {
    const {
      width = 1.1,
      passes = 2,
      wobble = 0.55,
      taper = 0.16,
      overshoot = 1.6,
      grain = 'hard',
      overlap = 0.08,
    } = opts;
    let { alpha = 0.9 } = opts;
    [color, alpha] = this.tone(color, alpha, 'line');
    let pts = resample(path.pts, 1.2);
    if (pts.length < 2) return;
    if (path.closed) {
      const start = Math.floor(this.r(0, pts.length));
      const extra = Math.ceil(pts.length * overlap);
      const ring = pts.concat(pts);
      pts = ring.slice(start, start + pts.length + extra);
    } else if (overshoot > 0) {
      pts = extend(pts, this.r(0.2, 1) * overshoot, this.r(0.2, 1) * overshoot);
    }
    const lc = this.begin();
    lc.fillStyle = color;
    for (let pass = 0; pass < passes; pass++) {
      const nA = noise1(this.rand);
      const nB = noise1(this.rand);
      const main = pass === 0;
      const w = width * (main ? 1 : this.r(0.55, 0.75));
      const amp = wobble * (main ? 1 : 1.5);
      let from = 0;
      let to = pts.length;
      if (!main) {
        from = Math.floor(pts.length * this.r(0, 0.25));
        to = Math.ceil(pts.length * this.r(0.7, 1));
      }
      const seg = pts.slice(from, to);
      if (seg.length < 2) continue;
      const left = [];
      const right = [];
      const n = seg.length;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const s = (from + i) * 1.2;
        const [nx, ny] = normalAt(seg, i);
        const wob = (nA(s / 26) - 0.5) * 2 * amp + (nB(s / 5) - 0.5) * 0.3;
        const x = seg[i][0] + nx * wob;
        const y = seg[i][1] + ny * wob;
        const ends = Math.min(1, t / taper, (1 - t) / taper);
        const pressure = (0.25 + 0.75 * smooth(ends)) * (0.82 + 0.3 * nB(s / 13));
        const hw = (w * pressure) / 2;
        left.push([x + nx * hw, y + ny * hw]);
        right.push([x - nx * hw, y - ny * hw]);
      }
      lc.globalAlpha = main ? 1 : 0.6;
      lc.beginPath();
      lc.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < n; i++) lc.lineTo(left[i][0], left[i][1]);
      for (let i = n - 1; i >= 0; i--) lc.lineTo(right[i][0], right[i][1]);
      lc.closePath();
      lc.fill();
    }
    lc.globalAlpha = 1;
    this.flush({ grain, alpha });
  }

  /** Several short strokes at once (e.g. a sparkle or a heart), sharing one layer. */
  marks(paths, color, opts = {}) {
    for (const p of paths) this.line(p, color, opts);
  }

  dot(x, y, r, color, { alpha = 0.8, grain = 'hard' } = {}) {
    [color, alpha] = this.tone(color, alpha, 'hatch');
    const lc = this.begin();
    lc.fillStyle = color;
    lc.beginPath();
    lc.ellipse(x, y, r, r * this.r(0.8, 1), this.r(0, 3), 0, TAU);
    lc.fill();
    this.flush({ grain, alpha });
  }

  // ------------------------------------------------------------ doodles

  sparkle(x, y, s, color, opts = {}) {
    const a = this.r(-0.15, 0.15);
    const p1 = new Path(x - Math.cos(a) * s, y - Math.sin(a) * s).quad(x, y, x + Math.cos(a) * s, y + Math.sin(a) * s);
    const p2 = new Path(x + Math.sin(a) * s, y - Math.cos(a) * s).quad(x, y, x - Math.sin(a) * s, y + Math.cos(a) * s);
    this.line(p1, color, { width: s * 0.28, passes: 1, wobble: 0.1, overshoot: 0, taper: 0.45, ...opts });
    this.line(p2, color, { width: s * 0.28, passes: 1, wobble: 0.1, overshoot: 0, taper: 0.45, ...opts });
  }

  heart(x, y, s, color, { fill = null, alpha = 0.9 } = {}) {
    const p = new Path(x, y + s * 0.9)
      .cubic(x - s * 1.4, y + s * 0.1, x - s * 0.9, y - s * 1.1, x, y - s * 0.35)
      .cubic(x + s * 0.9, y - s * 1.1, x + s * 1.4, y + s * 0.1, x, y + s * 0.9)
      .close();
    if (fill) this.wash(p, fill, { alpha: 0.8 });
    this.line(p, color, { width: Math.max(0.7, s * 0.22), passes: 1, alpha, overlap: 0.05 });
  }

  bean(x, y, s, angle, color = '#6b4430') {
    const body = Path.ellipse(x, y, s, s * 0.68, angle);
    this.wash(body, color, { alpha: 0.75 });
    this.hatch(body, '#3d261b', { spacing: 1.1, alpha: 0.35, angle: angle + 1.2 });
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const crease = new Path(x - c * s * 0.8, y - sn * s * 0.8).quad(
      x - sn * s * 0.25,
      y + c * s * 0.25,
      x + c * s * 0.8,
      y + sn * s * 0.8,
    );
    this.line(crease, '#2c1a12', { width: 0.8, passes: 1, overshoot: 0 });
    this.line(body, '#3a2418', { width: 0.85, passes: 1, alpha: 0.8 });
  }

  /** A wavy rising wisp of steam. */
  steam(x, y, h, color = '#9d8b80', { sway = 4, alpha = 0.45, width = 1.4 } = {}) {
    const p = new Path(x, y);
    const turns = 2 + Math.floor(this.r(0, 2));
    const phase = this.r(0, TAU);
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      p.pts.push([x + Math.sin(phase + t * turns * Math.PI) * sway * (0.4 + t), y - t * h]);
    }
    this.line(p, color, { width, alpha, passes: 1, taper: 0.4, wobble: 0.3, overshoot: 0 });
  }
}

function extend(pts, a, b) {
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[1];
  const la = Math.hypot(x1 - x0, y1 - y0) || 1;
  const [xn, yn] = pts[pts.length - 1];
  const [xm, ym] = pts[pts.length - 2];
  const lb = Math.hypot(xn - xm, yn - ym) || 1;
  const head = [];
  const tail = [];
  for (let d = a; d > 0; d -= 1.2) head.push([x0 - ((x1 - x0) / la) * d, y0 - ((y1 - y0) / la) * d]);
  for (let d = 1.2; d <= b; d += 1.2) tail.push([xn + ((xn - xm) / lb) * d, yn + ((yn - ym) / lb) * d]);
  return head.concat(pts, tail);
}

function smooth(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
