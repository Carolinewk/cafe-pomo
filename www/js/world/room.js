// The cafe room: a static background plus depth-sorted props, all pixel art.

import { Raster, darken, lighten, mix } from './pixel.js';
import { P, box, cylinder, wallQuad, screenBounds, TILE } from './iso.js';
import { mulberry32 } from '../art/rng.js';

export const W = 7 * TILE; // room size along x (right wall)
export const D = 6 * TILE; // room size along y (left wall)
export const H = 64; // wall height
export const ROOM_W = 220;
export const ROOM_H = 192;
export const OX = 102; // where world (0,0,0) lands inside the room raster
export const OY = 74;

export const OUT = '#4d3b39';

const C = {
  wallL: '#f6e8d6',
  wallR: '#ecdac3',
  wainL: '#a9c09e',
  wainR: '#97b08e',
  wainLine: '#8aa482',
  trim: '#fdf6ea',
  base: '#b99470',
  cap: '#fff8ee',
  capSide: '#dcc7ab',
  plank: ['#cf9f70', '#c99a6a', '#d4a676', '#c69567'],
  plankLine: '#ad7f55',
  slabL: '#a07150',
  slabR: '#875d40',
  wood: { top: '#dcb68c', left: '#bb8d62', right: '#a47750', edge: '#ecd0ad' },
  woodDark: { top: '#a8784f', left: '#8b5f3d', right: '#764f33', edge: '#bd8f66' },
  marble: { top: '#f4efe8', left: '#d9cfc4', right: '#c9bdb1', edge: '#fffaf4' },
  mint: { top: '#b7ddd0', left: '#9ccbbd', right: '#82b4a6', edge: '#d3ede4' },
  chrome: '#dde3e3',
  leaf: ['#86b46f', '#6c9d5a', '#a8cf8c', '#55834a'],
  pot: { top: '#d48b69', left: '#c47a59', right: '#a9644a', rim: '#e0a07f' },
  rug: '#e6b8b0',
  rugBorder: '#d39b93',
  rugInner: '#f0cdc6',
};

// ---------------------------------------------------------------- sky

/** Window sky colors for the current hour. */
export function skyFor(hour) {
  if (hour >= 6 && hour < 9) return { top: '#f7c9b0', bottom: '#fde3c8', cloud: '#fff4ea', stars: false, sun: '#fff1c9' };
  if (hour >= 9 && hour < 17) return { top: '#a9d6ec', bottom: '#d4ecf5', cloud: '#ffffff', stars: false, sun: null };
  if (hour >= 17 && hour < 19) return { top: '#f0a99a', bottom: '#fbd39d', cloud: '#fde7d6', stars: false, sun: '#ffe7a3' };
  return { top: '#3d4a78', bottom: '#5c6b9a', cloud: '#7a86b0', stars: true, sun: null, moon: '#fff4cf' };
}

// ---------------------------------------------------------------- background

/**
 * Floor, walls and everything fixed to them. Nothing ever walks behind these.
 * `menu` lists the cup colors of every unlocked drink, written on the chalkboard.
 */
export function drawBackground(hour = 12, menu = []) {
  const r = new Raster(ROOM_W, ROOM_H);
  const p = (x, y, z = 0) => P(OX, OY, x, y, z);
  const rand = mulberry32(42);

  // ---- floor slab sides and floor
  const slab = 6;
  r.poly([p(0, D, 0), p(W, D, 0), [p(W, D, 0)[0], p(W, D, 0)[1] + slab], [p(0, D, 0)[0], p(0, D, 0)[1] + slab]], C.slabL);
  r.poly([p(W, 0, 0), p(W, D, 0), [p(W, D, 0)[0], p(W, D, 0)[1] + slab], [p(W, 0, 0)[0], p(W, 0, 0)[1] + slab]], C.slabR);
  // planks run along x; each plank row is 4 units wide
  for (let y = 0; y < D; y += 4) {
    const row = Math.floor(y / 4);
    r.poly([p(0, y), p(W, y), p(W, y + 4), p(0, y + 4)], C.plank[row % C.plank.length]);
  }
  for (let y = 4; y < D; y += 4) r.poly([p(0, y), p(W, y), [p(W, y)[0], p(W, y)[1] + 1], [p(0, y)[0], p(0, y)[1] + 1]], C.plankLine);
  // staggered plank seams
  for (let y = 0; y < D; y += 4) {
    const row = Math.floor(y / 4);
    for (let x = (row % 3) * 6 + 4; x < W - 2; x += 18) {
      const a = p(x, y);
      const b = p(x, y + 4);
      r.line(a[0], a[1] + 1, b[0] + 1, b[1], C.plankLine);
    }
  }
  // floor edge highlight
  r.poly([p(0, D), p(W, D), [p(W, D)[0], p(W, D)[1] - 1], [p(0, D)[0], p(0, D)[1] - 1]], '#dfb487');
  r.poly([p(W, 0), p(W, D), [p(W, D)[0], p(W, D)[1] - 1], [p(W, 0)[0], p(W, 0)[1] - 1]], '#dfb487');

  // rug under the seating area
  const [rx, ry] = p(38, 30);
  r.ellipse(rx, ry, 40, 20, C.rugBorder);
  r.ellipse(rx, ry, 37, 18.5, C.rug);
  r.ellipse(rx, ry, 29, 14.5, C.rugInner);
  r.ellipse(rx, ry, 27, 13.5, C.rug);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    r.set(Math.round(rx + Math.cos(a) * 33), Math.round(ry + Math.sin(a) * 16.5), C.rugInner);
  }

  // ---- walls
  // left wall: plane x = 0, running along y
  wallQuad(r, OX, OY, 'L', 0, D, 0, H, C.wallL);
  wallQuad(r, OX, OY, 'L', 0, D, 0, 26, C.wainL);
  for (let y = 4; y < D; y += 6) wallQuad(r, OX, OY, 'L', y, y + 0.5, 4, 22, C.wainLine);
  wallQuad(r, OX, OY, 'L', 0, D, 24, 26, C.trim);
  wallQuad(r, OX, OY, 'L', 0, D, 0, 3, C.base);
  // right wall: plane y = 0, running along x
  wallQuad(r, OX, OY, 'R', 0, W, 0, H, C.wallR);
  wallQuad(r, OX, OY, 'R', 0, W, 0, 26, C.wainR);
  for (let x = 4; x < W; x += 6) wallQuad(r, OX, OY, 'R', x, x + 0.5, 4, 22, darken(C.wainR, 0.12));
  wallQuad(r, OX, OY, 'R', 0, W, 24, 26, darken(C.trim, 0.05));
  wallQuad(r, OX, OY, 'R', 0, W, 0, 3, darken(C.base, 0.1));
  // corner shadow line
  r.poly([p(0, 0, H), [p(0, 0, H)[0] + 1, p(0, 0, H)[1]], [p(0, 0, 0)[0] + 1, p(0, 0, 0)[1]], p(0, 0, 0)], darken(C.wallR, 0.12));

  drawWindow(r, hour, rand);
  drawDoor(r, skyFor(hour));
  drawMenuBoard(r, menu);
  drawShelves(r, rand);
  drawFrame(r);

  // ---- wall caps (thickness) and ends
  const t = 3;
  r.poly([p(-t, -t, H), p(W, -t, H), p(W, 0, H), p(0, 0, H), p(0, D, H), p(-t, D, H)], C.cap);
  r.poly([p(-t, D, H), p(0, D, H), p(0, D, 0), p(-t, D, 0)], C.capSide);
  r.poly([p(W, -t, H), p(W, 0, H), p(W, 0, 0), p(W, -t, 0)], darken(C.capSide, 0.08));
  // the floor slab under the wall ends
  r.poly([p(-t, D, 0), p(0, D, 0), [p(0, D, 0)[0], p(0, D, 0)[1] + slab], [p(-t, D, 0)[0], p(-t, D, 0)[1] + slab]], C.slabL);
  r.poly([p(W, -t, 0), p(W, 0, 0), [p(W, 0, 0)[0], p(W, 0, 0)[1] + slab], [p(W, -t, 0)[0], p(W, -t, 0)[1] + slab]], C.slabR);

  // ---- things standing against the walls
  drawBackCounter(r);
  drawWindowLedge(r);
  drawLightWires(r);

  return r;
}

/** String lights along the tops of both walls; bulbs are drawn (and twinkle) at runtime. */
export const LIGHTS = (() => {
  const bulbs = [];
  const sag = (t) => Math.sin(t * Math.PI) * 4;
  // left wall: hooks every 12 units along y
  for (let y0 = 0; y0 < D; y0 += 12) {
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      bulbs.push(P(OX, OY, 0, y0 + t * 12, 59 - sag(t)));
    }
  }
  for (let x0 = 0; x0 < W; x0 += 14) {
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      bulbs.push(P(OX, OY, x0 + t * 14, 0, 59 - sag(t)));
    }
  }
  return bulbs.map(([x, y], i) => ({ x: Math.round(x), y: Math.round(y) + 1, color: ['#ffd98a', '#ffb8a8', '#c9e7a8', '#ffe9b8'][i % 4] }));
})();

function drawLightWires(r) {
  const wire = '#8a7466';
  const sag = (t) => Math.sin(t * Math.PI) * 4;
  for (let y0 = 0; y0 < D; y0 += 12) {
    let prev = null;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const [x, y] = P(OX, OY, 0, y0 + t * 12, 59 - sag(t));
      const pt = [Math.round(x), Math.round(y)];
      if (prev) r.line(prev[0], prev[1], pt[0], pt[1], wire);
      prev = pt;
    }
  }
  for (let x0 = 0; x0 < W; x0 += 14) {
    let prev = null;
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const [x, y] = P(OX, OY, x0 + t * 14, 0, 59 - sag(t));
      const pt = [Math.round(x), Math.round(y)];
      if (prev) r.line(prev[0], prev[1], pt[0], pt[1], wire);
      prev = pt;
    }
  }
}

function drawWindow(r, hour, rand) {
  const sky = skyFor(hour);
  const x0 = 26;
  const x1 = 44;
  const z0 = 24;
  const z1 = 56;
  const p = (x, z) => P(OX, OY, x, 0, z);
  // frame
  wallQuad(r, OX, OY, 'R', x0 - 1.5, x1 + 1.5, z0 - 2, z1 + 2, '#fffaf3');
  // sky: vertical bands
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const za = z1 - ((z1 - z0) * i) / bands;
    const zb = z1 - ((z1 - z0) * (i + 1)) / bands;
    wallQuad(r, OX, OY, 'R', x0, x1, zb, za, mix(sky.top, sky.bottom, i / (bands - 1)));
  }
  if (sky.stars) {
    for (let i = 0; i < 14; i++) {
      const [sx, sy] = p(x0 + 1 + rand() * (x1 - x0 - 2), z0 + 2 + rand() * (z1 - z0 - 4));
      r.set(Math.round(sx), Math.round(sy), i % 4 ? '#e9ecff' : '#fff6c8');
    }
    const [mx, my] = p(x0 + 12, z1 - 9);
    r.ellipse(mx, my, 3.5, 3.5, sky.moon);
    r.ellipse(mx + 1.5, my - 1, 3, 3, mix(sky.top, sky.bottom, 0.2));
  } else {
    if (sky.sun) {
      const [sx, sy] = p(x0 + 5, z0 + 10);
      r.ellipse(sx, sy, 4, 4, sky.sun);
    }
    // two soft clouds
    for (const [cx, cz, s] of [[x0 + 5, z1 - 8, 1], [x0 + 13, z1 - 18, 0.8]]) {
      const [sx, sy] = p(cx, cz);
      r.ellipse(sx, sy, 6 * s, 2.5 * s, sky.cloud);
      r.ellipse(sx + 3 * s, sy - 2 * s, 4 * s, 2.5 * s, sky.cloud);
      r.ellipse(sx - 3 * s, sy - 1 * s, 3 * s, 2 * s, sky.cloud);
    }
    // distant rooftops and a tree
    for (let x = x0; x < x1; x += 3) {
      const hgt = 4 + Math.floor(rand() * 5);
      wallQuad(r, OX, OY, 'R', x, Math.min(x1, x + 3), z0, z0 + hgt, mix('#c9b8c9', '#a99db5', rand()));
    }
    const [tx, ty] = p(x1 - 4, z0 + 9);
    r.ellipse(tx, ty, 5, 5, '#8fb47f');
    r.ellipse(tx - 2, ty - 2, 3, 3, '#a8c994');
  }
  // mullions
  wallQuad(r, OX, OY, 'R', (x0 + x1) / 2 - 0.5, (x0 + x1) / 2 + 0.5, z0, z1, '#fffaf3');
  wallQuad(r, OX, OY, 'R', x0, x1, (z0 + z1) / 2 - 1, (z0 + z1) / 2 + 1, '#fffaf3');
  // frame shadow inside the top and left edges
  wallQuad(r, OX, OY, 'R', x0, x1, z1 - 1, z1, darken(sky.top, 0.12));
  // sill
  wallQuad(r, OX, OY, 'R', x0 - 2.5, x1 + 2.5, z0 - 3.5, z0 - 1.5, '#efe3d2');
  // curtains: soft panels on both sides
  const curtain = '#f3c6bd';
  wallQuad(r, OX, OY, 'R', x0 - 4, x0 + 1.5, z0 + 6, z1 + 4, curtain);
  wallQuad(r, OX, OY, 'R', x1 - 1.5, x1 + 4, z0 + 6, z1 + 4, curtain);
  for (const x of [x0 - 2.5, x0 - 0.5, x1, x1 + 2]) wallQuad(r, OX, OY, 'R', x, x + 0.5, z0 + 7, z1 + 3, darken(curtain, 0.1));
  wallQuad(r, OX, OY, 'R', x0 - 5, x1 + 5, z1 + 4, z1 + 5.5, '#b48a65');
  // tie-backs
  wallQuad(r, OX, OY, 'R', x0 - 4, x0 + 1.5, z0 + 12, z0 + 13.5, '#e39a8f');
  wallQuad(r, OX, OY, 'R', x1 - 1.5, x1 + 4, z0 + 12, z0 + 13.5, '#e39a8f');
}

function drawDoor(r, sky) {
  const x0 = 47;
  const x1 = 54;
  // frame and door leaf
  wallQuad(r, OX, OY, 'R', x0 - 1, x1 + 1, 0, 46, '#fff8ee');
  wallQuad(r, OX, OY, 'R', x0, x1, 0, 44, '#c38f63');
  wallQuad(r, OX, OY, 'R', x1 - 1, x1, 0, 44, '#a87650');
  // glass panel with a little sky
  wallQuad(r, OX, OY, 'R', x0 + 1.5, x1 - 1.5, 22, 40, mix(sky.top, '#ffffff', 0.35));
  wallQuad(r, OX, OY, 'R', x0 + 1.5, x1 - 1.5, 22, 25, mix(sky.bottom, '#ffffff', 0.2));
  // lower panels
  wallQuad(r, OX, OY, 'R', x0 + 1.5, x1 - 1.5, 5, 17, '#b5825a');
  wallQuad(r, OX, OY, 'R', x0 + 2, x1 - 2, 6, 16, '#c8946a');
  // knob
  const [kx, ky] = P(OX, OY, x0 + 1.5, 0, 20);
  r.set(Math.round(kx), Math.round(ky), '#f2d27a');
  r.set(Math.round(kx) + 1, Math.round(ky), '#d7ac4c');
  // welcome mat
  r.poly([P(OX, OY, x0, 1), P(OX, OY, x1, 1), P(OX, OY, x1, 7), P(OX, OY, x0, 7)], '#c9a6a0');
  r.poly([P(OX, OY, x0 + 1, 2), P(OX, OY, x1 - 1, 2), P(OX, OY, x1 - 1, 6), P(OX, OY, x0 + 1, 6)], '#d9b8b2');
}

function drawMenuBoard(r, menu) {
  const x0 = 8;
  const x1 = 22;
  const z0 = 34;
  const z1 = 56;
  wallQuad(r, OX, OY, 'R', x0 - 1, x1 + 1, z0 - 1, z1 + 1, '#a87650');
  wallQuad(r, OX, OY, 'R', x0, x1, z0, z1, '#4f5f57');
  const chalk = '#eef0e6';
  const dim = '#b9c4bc';
  // heading
  wallQuad(r, OX, OY, 'R', x0 + 3, x1 - 3, z1 - 4, z1 - 3, chalk);
  // one chalk line per unlocked drink: a dot in the drink's color, its "name" and a price
  const items = menu.length ? menu : [['#fffaf3', '#d8cfc6', '#8a5129']];
  const rows = Math.min(items.length, 8);
  for (let i = 0; i < rows; i++) {
    const col = i < 4 ? 0 : 1;
    const z = z1 - 8 - (i % 4) * 4;
    const xa = col ? x0 + 7.5 : x0 + 1.5;
    const [cup, , top] = items[i];
    wallQuad(r, OX, OY, 'R', xa, xa + 1, z, z + 1.5, top === '#fffaf3' || top === '#fffaf2' ? cup : top);
    wallQuad(r, OX, OY, 'R', xa + 1.5, xa + 4.5 - ((i * 7) % 3) * 0.5, z, z + 1, dim);
    wallQuad(r, OX, OY, 'R', xa + 5, xa + 5.5, z, z + 1, '#f2d27a');
  }
  // a little cup doodle in the corner
  const [cx, cy] = P(OX, OY, x1 - 4, 0, z0 + 3);
  r.rect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 3, chalk);
  r.set(Math.round(cx) + 2, Math.round(cy) - 1, chalk);
}

function drawShelves(r, rand) {
  // two floating shelves above the back counter on the left wall
  for (const z of [38, 50]) {
    box(r, OX, OY, 0, 6, z, 4, 24, 2, C.wood);
    // things on the shelf
    let y = 8;
    while (y < 28) {
      const kind = Math.floor(rand() * 4);
      const [sx, sy] = P(OX, OY, 2, y, z + 2);
      if (kind === 0) {
        // jar of beans
        r.rect(Math.round(sx) - 2, Math.round(sy) - 6, 4, 6, '#e9f1ef');
        r.rect(Math.round(sx) - 2, Math.round(sy) - 4, 4, 4, '#7a4a2e');
        r.rect(Math.round(sx) - 2, Math.round(sy) - 7, 4, 1, '#c9a27a');
        y += 5;
      } else if (kind === 1) {
        // stacked cups
        r.rect(Math.round(sx) - 2, Math.round(sy) - 3, 4, 3, '#fbf3ea');
        r.rect(Math.round(sx) - 2, Math.round(sy) - 6, 4, 3, '#f0c9bf');
        r.set(Math.round(sx) + 2, Math.round(sy) - 2, '#fbf3ea');
        y += 5;
      } else if (kind === 2) {
        // tiny plant
        r.rect(Math.round(sx) - 1, Math.round(sy) - 3, 3, 3, C.pot.left);
        r.ellipse(sx + 0.5, sy - 5, 2.5, 2, C.leaf[0]);
        r.set(Math.round(sx) - 1, Math.round(sy) - 7, C.leaf[2]);
        y += 5;
      } else {
        // coffee bag
        r.rect(Math.round(sx) - 2, Math.round(sy) - 7, 4, 7, '#d8bb92');
        r.rect(Math.round(sx) - 1, Math.round(sy) - 4, 2, 2, '#8e5b3a');
        y += 5;
      }
    }
  }
}

function drawFrame(r) {
  // a small framed coffee poster on the left wall, past the shelves
  const y0 = 36;
  const y1 = 44;
  wallQuad(r, OX, OY, 'L', y0 - 1, y1 + 1, 33, 51, '#b48a65');
  wallQuad(r, OX, OY, 'L', y0, y1, 34, 50, '#fbefdf');
  const [cx, cy] = P(OX, OY, 0, (y0 + y1) / 2, 40);
  r.ellipse(cx, cy, 4, 2, '#e39b8f');
  r.rect(Math.round(cx) - 3, Math.round(cy) - 1, 6, 4, '#fff7ee');
  r.rect(Math.round(cx) - 3, Math.round(cy) - 2, 6, 1, '#8e5b3a');
  r.set(Math.round(cx) - 1, Math.round(cy) - 5, '#c9b8b0');
  r.set(Math.round(cx), Math.round(cy) - 6, '#c9b8b0');
  r.set(Math.round(cx) + 1, Math.round(cy) - 5, '#c9b8b0');
  // wall sconce
  const [lx, ly] = P(OX, OY, 0, 46.5, 44);
  r.rect(Math.round(lx) - 1, Math.round(ly), 2, 3, '#b48a65');
  r.ellipse(lx, ly - 1, 3, 2, '#ffe6a8');
}

function drawBackCounter(r) {
  // cabinets along the left wall
  box(r, OX, OY, 0, 2, 0, 6, 32, 15, { top: C.marble.top, left: '#cfa57c', right: '#bb8d62', edge: C.marble.edge });
  // cabinet doors on the front (+x) face
  for (let y = 4; y < 32; y += 7) {
    const a = P(OX, OY, 6, y, 12);
    const b = P(OX, OY, 6, y + 5, 12);
    const c = P(OX, OY, 6, y + 5, 3);
    const d = P(OX, OY, 6, y, 3);
    r.poly([a, b, c, d], '#c99a6e');
    const k = P(OX, OY, 6, y + 4, 8);
    r.set(Math.round(k[0]), Math.round(k[1]), '#7b5232');
  }
  // espresso machine: a retro mint machine facing the barista
  box(r, OX, OY, 0.5, 9.5, 15, 5, 12, 11, C.mint);
  box(r, OX, OY, 0.5, 9.5, 26, 5, 12, 2, { top: '#f0f4f4', left: '#d5dcdc', right: '#c0c8c8' });
  box(r, OX, OY, 5.5, 10.5, 15, 1.5, 10, 1, { top: '#6d6460', left: '#5a524e', right: '#4c4542' });
  // pink stripe along the front
  r.poly([P(OX, OY, 5.5, 9.5, 24), P(OX, OY, 5.5, 21.5, 24), P(OX, OY, 5.5, 21.5, 23), P(OX, OY, 5.5, 9.5, 23)], '#efa9a0');
  for (const y of [12.5, 18.5]) {
    box(r, OX, OY, 5.5, y - 1, 19, 1.5, 2, 2, { top: '#f0f4f4', left: '#d5dcdc', right: '#b9c2c2' });
    const [hx, hy] = P(OX, OY, 7, y, 20);
    r.rect(Math.round(hx), Math.round(hy), 3, 1, '#3d3533');
    const [sx, sy] = P(OX, OY, 6.2, y, 18);
    r.rect(Math.round(sx), Math.round(sy), 1, 2, '#8d8682');
  }
  // gauge
  const [gx, gy] = P(OX, OY, 5.5, 15.5, 22);
  r.ellipse(gx, gy, 2, 2, '#fffaf0');
  r.set(Math.round(gx), Math.round(gy), '#c9564f');
  // steam wand
  const [wx, wy] = P(OX, OY, 5.8, 21, 22);
  r.line(Math.round(wx), Math.round(wy), Math.round(wx) - 1, Math.round(wy) + 5, '#a9b1b1');
  // cups warming on top
  for (const y of [11, 14, 17, 20]) {
    const [ux, uy] = P(OX, OY, 3, y, 28);
    r.rect(Math.round(ux) - 1, Math.round(uy) - 2, 3, 2, y % 2 ? '#fff8f0' : '#f0c9bf');
  }
  // grinder
  box(r, OX, OY, 1, 3.5, 15, 3.5, 3.5, 8, { top: '#585050', left: '#4a4343', right: '#3d3737' });
  const [hx, hy] = P(OX, OY, 2.75, 5.25, 23);
  r.poly([[hx - 3, hy - 5], [hx + 3, hy - 5], [hx + 2, hy], [hx - 2, hy]], '#d9c9a8');
  r.rect(Math.round(hx) - 2, Math.round(hy) - 4, 4, 2, '#7a4a2e');
  // a stack of cups and a jar at the far end
  for (let i = 0; i < 3; i++) {
    const [ux, uy] = P(OX, OY, 3, 27, 15 + i * 2);
    r.rect(Math.round(ux) - 2, Math.round(uy) - 2, 4, 2, i % 2 ? '#f0c9bf' : '#fff8f0');
  }
  const [jx, jy] = P(OX, OY, 3, 31.5, 15);
  r.rect(Math.round(jx) - 2, Math.round(jy) - 6, 4, 6, '#f6efe4');
  r.rect(Math.round(jx) - 2, Math.round(jy) - 3, 4, 3, '#efc06a');
}

function drawWindowLedge(r) {
  // a narrow bar under the window for the stool seats
  box(r, OX, OY, 24, 0, 17, 22, 3, 2, C.wood);
  for (const x of [25, 44]) box(r, OX, OY, x, 0.5, 0, 1, 1, 17, C.woodDark);
}

// ---------------------------------------------------------------- props

/**
 * Build a depth-sorted prop. `draw(r, ox, oy)` paints in world coordinates with the
 * world origin at (ox, oy) inside a private raster that is then outlined.
 */
function makeProp(name, bounds, draw, { outline = OUT, pad = 3 } = {}) {
  const s = screenBounds(bounds);
  const w = Math.ceil(s.maxX - s.minX) + pad * 2;
  const h = Math.ceil(s.maxY - s.minY) + pad * 2;
  const r = new Raster(w, h);
  const ox = -s.minX + pad;
  const oy = -s.minY + pad;
  draw(r, ox, oy);
  if (outline) r.outline(outline);
  return { name, box: bounds, raster: r, dx: s.minX - pad, dy: s.minY - pad };
}

export function buildProps() {
  const props = [];

  // front counter with register and a pastry case
  props.push(
    makeProp('counter', { x0: 12, y0: 0, z0: 0, x1: 18, y1: 30, z1: 26 }, (r, ox, oy) => {
      box(r, ox, oy, 12, 0, 0, 6, 30, 16, { top: C.marble.top, left: '#c39066', right: '#d3a074', edge: C.marble.edge });
      // panelling on the customer side
      for (let y = 2; y < 29; y += 4) {
        const a = P(ox, oy, 18, y, 13);
        const b = P(ox, oy, 18, y + 3, 13);
        const c = P(ox, oy, 18, y + 3, 2);
        const d = P(ox, oy, 18, y, 2);
        r.poly([a, b, c, d], '#c8946a');
      }
      box(r, ox, oy, 12, 0, 13, 6, 30, 1, { top: C.marble.top, left: '#b98760', right: '#e0b58a' });
      // register
      box(r, ox, oy, 13, 4, 16, 4, 5, 4, { top: '#efe4d6', left: '#d8c6b2', right: '#c9b39d' });
      box(r, ox, oy, 13.5, 4.5, 20, 2, 4, 3, { top: '#7c8f86', left: '#6b7d74', right: '#5c6c64' });
      // cake stand with a strawberry cake
      cylinder(r, ox, oy, 15, 21, 16, 1.5, 2, { top: '#f6f0e8', left: '#e3d8cc' });
      cylinder(r, ox, oy, 15, 21, 18, 8, 1, { top: '#fffaf3', left: '#e8ddd0', right: '#d8cbbd' });
      cylinder(r, ox, oy, 15, 21, 19, 5.5, 5, { top: '#fff3f5', left: '#f4c2cd', right: '#e6a9b7', rim: '#ffffff' });
      const [kx, ky] = P(ox, oy, 15, 21, 24);
      r.set(Math.round(kx) - 2, Math.round(ky) - 1, '#e2525e');
      r.set(Math.round(kx) + 1, Math.round(ky) - 1, '#e2525e');
      r.set(Math.round(kx) - 1, Math.round(ky) + 1, '#e2525e');
      // a second little treat: a plate of cookies
      cylinder(r, ox, oy, 15, 27, 16, 4.5, 1, { top: '#fffaf3', left: '#e8ddd0' });
      const [ck, cky] = P(ox, oy, 15, 27, 17);
      r.rect(Math.round(ck) - 3, Math.round(cky) - 1, 3, 2, '#d9a066');
      r.rect(Math.round(ck) + 1, Math.round(cky) - 2, 3, 2, '#c98d5e');
      // tip jar and a tiny vase
      const [jx, jy] = P(ox, oy, 15, 11.5, 16);
      r.rect(Math.round(jx) - 1, Math.round(jy) - 4, 3, 4, '#e3f1f2');
      r.set(Math.round(jx), Math.round(jy) - 2, '#f2d27a');
      const [vx, vy] = P(ox, oy, 15, 15.5, 16);
      r.rect(Math.round(vx) - 1, Math.round(vy) - 3, 2, 3, '#9fb6d1');
      r.set(Math.round(vx) - 1, Math.round(vy) - 5, '#f3a3a8');
      r.set(Math.round(vx) + 1, Math.round(vy) - 6, '#f9d27c');
      r.set(Math.round(vx), Math.round(vy) - 4, C.leaf[0]);
    }),
  );

  // round tables with two chairs each
  for (const t of TABLES) {
    props.push(table(t.x, t.y));
    for (const s of t.seats) props.push(chair(s.x, s.y, s.facing));
  }
  for (const s of STOOLS) props.push(stool(s.x, s.y));

  // plants
  props.push(plant('plantCorner', 5, 43, 34));
  props.push(plant('plantDoor', 53, 21, 22));
  props.push(cushion(CAT.x, CAT.y));
  return props;
}

function table(x, y) {
  return makeProp(`table@${x},${y}`, { x0: x - 3.5, y0: y - 3.5, z0: 0, x1: x + 3.5, y1: y + 3.5, z1: 13 }, (r, ox, oy) => {
    cylinder(r, ox, oy, x, y, 0, 3, 1, { top: '#6f5b54', left: '#5d4b45' });
    const [lx, ly] = P(ox, oy, x, y, 0);
    r.rect(Math.round(lx) - 1, Math.round(ly) - 11, 2, 11, '#5d4b45');
    cylinder(r, ox, oy, x, y, 10, 11, 2, { top: '#f6f0e8', left: '#ddd2c6', right: '#cbbfb2', rim: '#fffaf3' });
  });
}

function chair(x, y, facing) {
  return makeProp(`chair@${x},${y}`, { x0: x - 2.4, y0: y - 2.4, z0: 0, x1: x + 2.4, y1: y + 2.4, z1: 18 }, (r, ox, oy) => {
    const frame = { top: '#8a5f45', left: '#7a5440', right: '#6a4836' };
    const rattan = { top: '#efd9ae', left: '#dcc394', right: '#cdb282', rim: '#f8ead0' };
    for (const [lx, ly] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
      const [px, py] = P(ox, oy, x + lx, y + ly, 0);
      r.rect(Math.round(px), Math.round(py) - 7, 1, 7, frame.left);
    }
    // backrest on the far side
    if (facing === 'E') {
      box(r, ox, oy, x - 2.4, y - 2, 8, 0.8, 4, 9, frame);
      box(r, ox, oy, x - 2.1, y - 1.4, 10, 0.3, 2.8, 5, rattan);
    } else {
      box(r, ox, oy, x - 2, y - 2.4, 8, 4, 0.8, 9, frame);
      box(r, ox, oy, x - 1.4, y - 2.1, 10, 2.8, 0.3, 5, rattan);
    }
    cylinder(r, ox, oy, x, y, 7, 6, 1, rattan);
  });
}

function stool(x, y) {
  return makeProp(`stool@${x},${y}`, { x0: x - 2.5, y0: y - 2.5, z0: 0, x1: x + 2.5, y1: y + 2.5, z1: 13 }, (r, ox, oy) => {
    const [lx, ly] = P(ox, oy, x, y, 0);
    r.rect(Math.round(lx) - 3, Math.round(ly) - 11, 1, 11, '#6f5b54');
    r.rect(Math.round(lx) + 2, Math.round(ly) - 11, 1, 11, '#5d4b45');
    r.rect(Math.round(lx) - 3, Math.round(ly) - 5, 6, 1, '#6f5b54');
    cylinder(r, ox, oy, x, y, 10, 5, 2, { top: '#e8a49b', left: '#d38c84', right: '#c27b74', rim: '#f3bdb5' });
  });
}

function plant(name, x, y, height) {
  return makeProp(name, { x0: x - 4, y0: y - 4, z0: 0, x1: x + 4, y1: y + 4, z1: height + 12 }, (r, ox, oy) => {
    cylinder(r, ox, oy, x, y, 0, 6, 9, { top: '#5a4136', left: C.pot.left, right: C.pot.right, rim: C.pot.rim });
    const [cx, cy] = P(ox, oy, x, y, 9);
    const rand = mulberry32(Math.round(x * 31 + y));
    // stems
    for (let i = 0; i < 5; i++) {
      const ex = cx + (rand() - 0.5) * 16;
      const ey = cy - height * (0.5 + rand() * 0.5);
      r.line(Math.round(cx), Math.round(cy - 1), Math.round(ex), Math.round(ey), C.leaf[3]);
    }
    // leaves: overlapping blobs, darker at the back
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      const lx = cx + (rand() - 0.5) * 18 * (0.6 + t * 0.6);
      const ly = cy - 4 - rand() * height;
      const col = C.leaf[i < 5 ? 3 : i < 11 ? 1 : i % 2 ? 0 : 2];
      r.ellipse(lx, ly, 3 + rand() * 2, 2 + rand() * 1.2, col);
    }
  });
}

function cushion(x, y) {
  return makeProp('cushion', { x0: x - 4, y0: y - 4, z0: 0, x1: x + 4, y1: y + 4, z1: 4 }, (r, ox, oy) => {
    cylinder(r, ox, oy, x, y, 0, 9, 3, { top: '#c9d9ec', left: '#a9bfd9', right: '#94abc6', rim: '#dde8f4' });
  });
}

// ---------------------------------------------------------------- layout

/** Seats: where a customer sits and which way they face. */
export const TABLES = [
  {
    x: 37,
    y: 22,
    seats: [
      { x: 31, y: 22, facing: 'E' },
      { x: 37, y: 16, facing: 'S' },
    ],
  },
  {
    x: 46,
    y: 37,
    seats: [
      { x: 40, y: 37, facing: 'E' },
      { x: 46, y: 31, facing: 'S' },
    ],
  },
  {
    x: 29,
    y: 39,
    seats: [
      { x: 23, y: 39, facing: 'E' },
      { x: 29, y: 33, facing: 'S' },
    ],
  },
];

export const CAT = { x: 52, y: 43 };

export const STOOLS = [
  { x: 30, y: 6 },
  { x: 39, y: 6 },
];
