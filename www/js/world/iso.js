// Habbo-style 2:1 isometric projection.
// World units: one step along X moves the screen (+2, +1), along Y (-2, +1), along Z (0, -1).
// A floor tile is 8 x 8 units, i.e. a 32 x 16 pixel diamond.

import { Raster } from './pixel.js';

export const TILE = 8;

export const isoX = (x, y) => 2 * (x - y);
export const isoY = (x, y, z = 0) => x + y - z;

/** Screen point of a world point, given where the world origin lands. */
export const P = (ox, oy, x, y, z = 0) => [ox + 2 * (x - y), oy + (x + y) - z];

/**
 * Axis-aligned box from (x, y, z) with size (w, d, h).
 * colors: { top, left, right, edge? } — left is the face looking down-left (+Y), right looks down-right (+X).
 */
export function box(r, ox, oy, x, y, z, w, d, h, colors) {
  const p = (X, Y, Z) => P(ox, oy, X, Y, Z);
  if (h > 0) {
    r.poly([p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x, y + d, z)], colors.left);
    r.poly([p(x + w, y, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x + w, y, z)], colors.right);
  }
  r.poly([p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)], colors.top);
  if (colors.edge) {
    // a 1px highlight along the two front edges of the top face
    const a = p(x, y + d, z + h);
    const b = p(x + w, y + d, z + h);
    const c = p(x + w, y, z + h);
    r.poly([a, b, [b[0], b[1] - 1], [a[0], a[1] - 1]], colors.edge);
    r.poly([b, c, [c[0], c[1] - 1], [b[0], b[1] - 1]], colors.edge);
  }
}

/** Upright cylinder, centred on world (x, y), standing on z; radius in screen pixels (rx), ry = rx / 2. */
export function cylinder(r, ox, oy, x, y, z, rx, h, colors) {
  const [cx, cy] = P(ox, oy, x, y, z);
  const ry = rx / 2;
  // side: bottom half-ellipse plus the rectangle up to the top centre
  const side = new Raster(r.w, r.h);
  side.ellipse(cx, cy, rx, ry, colors.left);
  side.rect(Math.round(cx - rx), Math.round(cy - h), Math.round(rx * 2), h, colors.left);
  if (colors.right) {
    // darker right third
    const split = Math.round(cx + rx * 0.3);
    for (let yy = 0; yy < side.h; yy++) {
      for (let xx = split; xx < side.w; xx++) if (side.get(xx, yy) >>> 24) side.set(xx, yy, colors.right);
    }
  }
  r.blit(side, 0, 0);
  r.ellipse(cx, cy - h, rx, ry, colors.top);
  if (colors.rim) {
    // lighter front rim of the top
    const rim = new Raster(r.w, r.h);
    rim.ellipse(cx, cy - h, rx, ry, colors.rim);
    const inner = new Raster(r.w, r.h);
    inner.ellipse(cx, cy - h - 1, rx - 1, ry - 0.5, colors.top);
    rim.blit(inner, 0, 0);
    r.blit(rim, 0, 0);
  }
}

/** A flat quad painted on a wall. wall 'L' is the plane x = 0, 'R' the plane y = 0. a..b runs along the wall. */
export function wallQuad(r, ox, oy, wall, a, b, z0, z1, color, depth = 0) {
  const p = wall === 'L' ? (t, z) => P(ox, oy, depth, t, z) : (t, z) => P(ox, oy, t, depth, z);
  r.poly([p(a, z1), p(b, z1), p(b, z0), p(a, z0)], color);
}

/** Screen-space bounding box of a world AABB relative to the world origin. */
export function screenBounds({ x0, y0, z0, x1, y1, z1 }) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const x of [x0, x1]) {
    for (const y of [y0, y1]) {
      for (const z of [z0, z1]) {
        const sx = 2 * (x - y);
        const sy = x + y - z;
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Draw order for isometric objects: a is behind b when it is separated from b on the
 * far side of an axis. Objects whose boxes overlap fall back to height, then centre.
 */
export function isBehind(a, b) {
  if (a.x1 <= b.x0) return true;
  if (b.x1 <= a.x0) return false;
  if (a.y1 <= b.y0) return true;
  if (b.y1 <= a.y0) return false;
  if (a.z1 <= b.z0) return true;
  if (b.z1 <= a.z0) return false;
  return a.x0 + a.x1 + a.y0 + a.y1 < b.x0 + b.x1 + b.y0 + b.y1;
}

/** Topologically sort drawables ({box, rect}) so every object is drawn after what it covers. */
export function depthSort(items) {
  const n = items.length;
  const deps = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = items[i];
    for (let j = i + 1; j < n; j++) {
      const b = items[j];
      const ra = a.rect;
      const rb = b.rect;
      if (ra.x1 <= rb.x0 || rb.x1 <= ra.x0 || ra.y1 <= rb.y0 || rb.y1 <= ra.y0) continue;
      if (isBehind(a.box, b.box)) deps[j].push(i);
      else deps[i].push(j);
    }
  }
  const out = [];
  const state = new Uint8Array(n);
  // stable: visit in order of centre depth so unrelated objects keep a sensible order
  const order = [...items.keys()].sort((i, j) => {
    const a = items[i].box;
    const b = items[j].box;
    return a.x0 + a.x1 + a.y0 + a.y1 - (b.x0 + b.x1 + b.y0 + b.y1);
  });
  const visit = (i) => {
    if (state[i] === 2) return;
    if (state[i] === 1) return; // cycle: ignore the back edge
    state[i] = 1;
    for (const d of deps[i]) visit(d);
    state[i] = 2;
    out.push(items[i]);
  };
  for (const i of order) visit(i);
  return out;
}
