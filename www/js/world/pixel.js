// Pixel buffers with exact, anti-alias-free drawing for the cafe's pixel art.

const cache = new Map();

/** '#rrggbb' or '#rrggbbaa' -> packed little-endian RGBA (as stored by ImageData). */
export function rgba(hex) {
  if (typeof hex === 'number') return hex;
  let v = cache.get(hex);
  if (v !== undefined) return v;
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  cache.set(hex, v);
  return v;
}

/** Mix two '#rrggbb' colors; t = 0 gives a, 1 gives b. */
export function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export const darken = (c, t = 0.25) => mix(c, '#2a1a1a', t);
export const lighten = (c, t = 0.25) => mix(c, '#ffffff', t);

export class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }

  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.data[y * this.w + x];
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = rgba(c);
  }

  span(y, x0, x1, c) {
    if (y < 0 || y >= this.h) return;
    const v = rgba(c);
    const a = Math.max(0, x0);
    const b = Math.min(this.w, x1);
    const row = y * this.w;
    for (let x = a; x < b; x++) this.data[row + x] = v;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) this.span(y + j, x, x + w, c);
  }

  /** Scanline fill sampling pixel centres, so 2:1 iso edges step cleanly. */
  poly(pts, c) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [, y] of pts) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const xs = [];
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay === by) continue;
        if ((yc >= ay && yc < by) || (yc >= by && yc < ay)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) this.span(y, Math.ceil(xs[i] - 0.5), Math.ceil(xs[i + 1] - 0.5), c);
    }
  }

  /** Filled ellipse centred on (cx, cy) in pixel units (cx may be x.5 for even widths). */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      this.span(y, Math.round(cx - half), Math.round(cx + half), c);
    }
  }

  line(x0, y0, x1, y1, c) {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Copy opaque pixels of another raster onto this one. */
  blit(src, dx, dy, { flip = false } = {}) {
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + (flip ? src.w - 1 - x : x)];
        if (v >>> 24 === 0) continue;
        const tx = x + dx;
        if (tx < 0 || tx >= this.w) continue;
        this.data[ty * this.w + tx] = v;
      }
    }
  }

  /** Wrap opaque pixels with a 1px outline (4-neighbourhood). */
  outline(color, { diagonals = false } = {}) {
    const v = rgba(color);
    const out = this.data.slice();
    const { w, h, data } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[y * w + x] >>> 24) continue;
        const near =
          (x > 0 && data[y * w + x - 1] >>> 24) ||
          (x < w - 1 && data[y * w + x + 1] >>> 24) ||
          (y > 0 && data[(y - 1) * w + x] >>> 24) ||
          (y < h - 1 && data[(y + 1) * w + x] >>> 24) ||
          (diagonals &&
            ((x > 0 && y > 0 && data[(y - 1) * w + x - 1] >>> 24) ||
              (x < w - 1 && y > 0 && data[(y - 1) * w + x + 1] >>> 24) ||
              (x > 0 && y < h - 1 && data[(y + 1) * w + x - 1] >>> 24) ||
              (x < w - 1 && y < h - 1 && data[(y + 1) * w + x + 1] >>> 24)));
        if (near) out[y * w + x] = v;
      }
    }
    this.data = out;
  }

  /** Replace every opaque pixel of color `from` with `to`. */
  recolor(from, to) {
    const a = rgba(from);
    const b = rgba(to);
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === a) this.data[i] = b;
  }

  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    g.putImageData(img, 0, 0);
    return c;
  }
}

/**
 * Parse a text sprite. Each character maps through `palette` to a color; '.' and ' '
 * are transparent. Returns a Raster.
 */
export function textSprite(rows, palette) {
  const w = Math.max(...rows.map((r) => r.length));
  const r = new Raster(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const c = palette[ch];
      if (c) r.set(x, y, c);
    }
  });
  return r;
}
