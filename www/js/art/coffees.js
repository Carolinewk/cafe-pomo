// Colored-pencil illustrations of every drink on the menu.
// Each drawing works in the 200 x 200 space of pencil.js (origin top-left, +y down).

import { Sketch, Path, Shape } from './pencil.js';
import { hashString } from './rng.js';

const PI = Math.PI;

export const INK = '#4a3227';
const INK_SOFT = '#6f5444';
const CUP = '#fbf5ee';
const CUP_SHADE = '#bfa999';
const GLASS_LINE = '#6b7b80';
const WHITE = '#ffffff';

// ------------------------------------------------------------ shared parts

/** A soft pastel disc behind the drink, like a sticker background. */
function backdrop(sk, color, cx = 100, cy = 104, r = 74) {
  if (!sk.backdrop) return;
  const blob = Path.ellipse(cx, cy, r, r * 0.97, sk.r(0, PI));
  sk.wash(blob, color, { alpha: 0.38 });
  sk.hatch(blob, color, { angle: -0.95, spacing: 2.6, width: 1.1, alpha: 0.32, inset: 4, overshoot: 1 });
}

function saucer(sk, cx, cy, rx, ry, { tint = CUP, shade = CUP_SHADE, rim = null } = {}) {
  const top = Path.ellipse(cx, cy, rx, ry);
  const side = new Path(cx - rx, cy).arc(cx, cy, rx, ry, PI, 0).arc(cx, cy + 4, rx - 1.5, ry, 0, PI).close();
  sk.erase(side);
  sk.erase(top);
  sk.wash(side, shade, { alpha: 0.7 });
  sk.hatch(side, INK_SOFT, { angle: -0.4, spacing: 1.4, alpha: 0.35 });
  sk.wash(top, tint, { alpha: 0.9 });
  sk.hatch(top, shade, {
    angle: -0.35,
    spacing: 1.8,
    alpha: 0.5,
    mask: { from: [cx - rx, cy], to: [cx + rx, cy], stops: [[0, 0.25], [0.55, 0.05], [1, 0.9]] },
  });
  const well = Path.ellipse(cx, cy - 1, rx * 0.55, ry * 0.52);
  sk.hatch(well, shade, { angle: 0.3, spacing: 1.5, alpha: 0.45 });
  if (rim) {
    const band = new Shape(Path.ellipse(cx, cy, rx - 3, ry - 1.6), Path.ellipse(cx, cy, rx - 6.5, ry - 3.2));
    sk.wash(band, rim, { alpha: 0.75 });
  }
  sk.line(well, INK_SOFT, { width: 0.7, alpha: 0.55, passes: 1 });
  sk.line(top, INK, { width: 1.15 });
  sk.line(new Path(cx - rx + 0.5, cy + 1).arc(cx, cy + 4, rx - 1.5, ry, PI, 0), INK, { width: 1.1 });
}

/** A round wooden coaster or board. */
function coaster(sk, cx, cy, rx, ry, { wood = '#d2a57a', dark = '#9c6a45', thick = 5 } = {}) {
  const top = Path.ellipse(cx, cy, rx, ry);
  const side = new Path(cx - rx, cy).arc(cx, cy, rx, ry, PI, 0).arc(cx, cy + thick, rx, ry, 0, PI).close();
  sk.erase(side);
  sk.erase(top);
  sk.wash(side, dark, { alpha: 0.75 });
  sk.hatch(side, '#5d3b26', { angle: -0.2, spacing: 1.3, alpha: 0.4 });
  sk.wash(top, wood, { alpha: 0.85 });
  for (let i = 0; i < 4; i++) {
    const rr = rx * (0.25 + i * 0.2);
    const ring = new Path(cx - rr, cy + sk.r(-1, 1)).arc(cx + sk.r(-3, 3), cy, rr, rr * (ry / rx), PI * 1.1, PI * 1.85);
    sk.line(ring, dark, { width: 0.6, alpha: 0.45, passes: 1, overshoot: 0 });
  }
  sk.line(top, INK, { width: 1.1 });
  sk.line(new Path(cx - rx, cy + 0.5).line(cx - rx, cy + thick).arc(cx, cy + thick, rx, ry, PI, 0).line(cx + rx, cy), INK, {
    width: 1.05,
    overshoot: 0,
  });
}

/** A soft shadow ellipse cast on a surface. */
function shadow(sk, cx, cy, rx, ry, color = '#8c6f62', alpha = 0.5) {
  sk.hatch(Path.ellipse(cx, cy, rx, ry), color, { angle: -0.3, spacing: 1.2, alpha, cross: 0.9, inset: 2 });
}

/** A rounded ceramic cup in three-quarter view. */
function cupShapes(cx, rimY, rx, ry, baseY, baseRx, belly = 0.6) {
  const rim = Path.ellipse(cx, rimY, rx, ry);
  const l = cx - rx;
  const r = cx + rx;
  const bl = cx - baseRx;
  const br = cx + baseRx;
  const drop = baseY - rimY;
  const sides = () =>
    new Path(l, rimY)
      .cubic(l - 0.5, rimY + drop * belly, bl - (rx - baseRx) * 0.35, baseY - 1, bl, baseY)
      .arc(cx, baseY, baseRx, ry * 0.45, PI, 0)
      .cubic(br + (rx - baseRx) * 0.35, baseY - 1, r + 0.5, rimY + drop * belly, r, rimY);
  const body = sides().arc(cx, rimY, rx, ry, 0, PI).close();
  return { rim, body, outline: sides() };
}

function paintCupBody(sk, body, cx, rx, rimY, { tint = CUP, shade = CUP_SHADE, highlight = true } = {}) {
  sk.erase(body);
  sk.wash(body, tint, { alpha: 0.95 });
  sk.hatch(body, shade, {
    angle: -1.25,
    spacing: 1.6,
    alpha: 0.55,
    mask: { from: [cx - rx, 0], to: [cx + rx, 0], stops: [[0, 0.35], [0.35, 0], [0.7, 0.55], [1, 1]] },
  });
  if (highlight) {
    const hl = new Path(cx - rx * 0.72, rimY + 7).quad(cx - rx * 0.8, rimY + 18, cx - rx * 0.55, rimY + 30);
    sk.line(hl, WHITE, { width: 2.4, alpha: 0.9, passes: 1, grain: null, overshoot: 0, taper: 0.35 });
  }
}

/** A C-shaped handle on the right side of a cup (drawn before the body so its ends tuck behind). */
function handle(sk, x, y, size, { tint = CUP, shade = CUP_SHADE, w = 6 } = {}) {
  const center = new Path(x - 4, y).cubic(x + size * 1.05, y - size * 0.25, x + size * 1.15, y + size * 1.15, x - 6, y + size * 1.2);
  const band = Path.ribbon(center, w, w * 0.8);
  sk.erase(band);
  sk.wash(band, tint, { alpha: 0.95 });
  sk.hatch(band, shade, { angle: -0.5, spacing: 1.4, alpha: 0.55 });
  sk.line(band, INK, { width: 1.05, overlap: 0.02 });
}

/** Straight-sided (tapered) glass or mug. */
function glass(cx, topY, rx, ry, botY, bRx) {
  const rxAt = (y) => rx + ((bRx - rx) * (y - topY)) / (botY - topY);
  const ryAt = (y) => (ry * rxAt(y)) / rx;
  const sides = () => new Path(cx - rx, topY).line(cx - bRx, botY).arc(cx, botY, bRx, ryAt(botY), PI, 0).line(cx + rx, topY);
  const g = {
    cx,
    topY,
    botY,
    rx,
    ry,
    bRx,
    rxAt,
    ryAt,
    rim: Path.ellipse(cx, topY, rx, ry),
    body: sides().arc(cx, topY, rx, ry, 0, PI).close(),
    outline: sides(),
    /** Ellipse of a liquid surface at height y. */
    surface: (y, shrink = 0) => Path.ellipse(cx, y, rxAt(y) - shrink, ryAt(y) - shrink * (ry / rx)),
    /** Silhouette of the liquid filled up to level y, including its visible top. */
    liquid(y, inset = 0.8) {
      const r = rxAt(y) - inset;
      const rb = bRx - inset;
      return new Path(cx - r, y)
        .arc(cx, y, r, ryAt(y) - inset * 0.3, PI, 2 * PI)
        .line(cx + rb, botY - inset)
        .arc(cx, botY - inset, rb, ryAt(botY) - inset * 0.3, 0, PI)
        .close();
    },
    /** The front-facing band of liquid between heights y1 (top) and y2 (bottom). */
    band(y1, y2, inset = 0.8) {
      const r1 = rxAt(y1) - inset;
      const r2 = rxAt(y2) - inset;
      return new Path(cx - r1, y1)
        .arc(cx, y1, r1, ryAt(y1), PI, 0)
        .line(cx + r2, y2)
        .arc(cx, y2, r2, ryAt(y2), 0, PI)
        .close();
    },
  };
  return g;
}

/** Outline and shine of a clear glass, drawn after its contents. */
function paintGlassFront(sk, g, { thickBase = 0, lineColor = GLASS_LINE } = {}) {
  if (thickBase) {
    const base = g.band(g.botY - thickBase, g.botY, 0.6);
    sk.wash(base, '#dfe9ea', { alpha: 0.8 });
    sk.line(new Path(g.cx - g.rxAt(g.botY - thickBase) + 1, g.botY - thickBase).arc(g.cx, g.botY - thickBase, g.rxAt(g.botY - thickBase) - 1, g.ryAt(g.botY - thickBase), PI, 0), lineColor, {
      width: 0.7,
      alpha: 0.5,
      passes: 1,
    });
  }
  const h = g.botY - g.topY;
  const l1 = new Path(g.cx - g.rx * 0.78, g.topY + h * 0.12).line(g.cx - g.rxAt(g.topY + h * 0.75) * 0.8, g.topY + h * 0.75);
  sk.line(l1, WHITE, { width: 3, alpha: 0.85, passes: 1, grain: null, overshoot: 0, taper: 0.3 });
  const l2 = new Path(g.cx - g.rx * 0.6, g.topY + h * 0.18).line(g.cx - g.rxAt(g.topY + h * 0.4) * 0.62, g.topY + h * 0.4);
  sk.line(l2, WHITE, { width: 1.4, alpha: 0.8, passes: 1, grain: null, overshoot: 0, taper: 0.3 });
  const r1 = new Path(g.cx + g.rx * 0.82, g.topY + h * 0.2).line(g.cx + g.rxAt(g.topY + h * 0.6) * 0.84, g.topY + h * 0.6);
  sk.line(r1, WHITE, { width: 1.6, alpha: 0.7, passes: 1, grain: null, overshoot: 0, taper: 0.3 });
  sk.line(g.outline, lineColor, { width: 1.05, alpha: 0.95 });
  sk.line(g.rim, lineColor, { width: 1, alpha: 0.9 });
}

/** A puffy rounded blob (squarish ellipse) used for piped cream. */
function puff(cx, cy, rx, ry, squareness = 2.7) {
  const p = new Path(0, 0);
  p.pts = [];
  const e = 2 / squareness;
  for (let j = 0; j < 72; j++) {
    const a = (j / 72) * PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    p.pts.push([cx + Math.sign(c) * Math.abs(c) ** e * rx, cy + Math.sign(s) * Math.abs(s) ** e * ry]);
  }
  return p.close();
}

/** Whipped cream as stacked puffy tiers ending in a little curl. Returns the tier rows for toppings. */
function whippedCream(sk, cx, baseY, w, h, { tint = '#fffaf3', shade = '#d9c6b4', tiers = 3 } = {}) {
  const rows = [];
  const step = (h - 8) / tiers;
  for (let i = 0; i < tiers; i++) {
    const rx = (w / 2) * (1 - (i / tiers) * 0.62);
    const ry = step * 0.78;
    const y = baseY - ry * 0.75 - step * i;
    rows.push({ y, rx, ry });
  }
  const top = rows[rows.length - 1];
  const tipY = top.y - top.ry * 0.6;
  const tip = Path.through(
    [
      [cx - top.rx * 0.55, tipY + 2],
      [cx - top.rx * 0.4, tipY - 6],
      [cx + 1, tipY - 11],
      [cx + 6, tipY - 15],
      [cx + 5, tipY - 8],
      [cx + top.rx * 0.5, tipY + 2],
    ],
    true,
  );
  const shapes = rows.map(({ y, rx, ry }) => puff(cx, y, rx, ry)).concat([tip]);
  shapes.forEach((s, i) => {
    sk.erase(s);
    sk.wash(s, tint, { alpha: 0.95 });
    sk.hatch(s, shade, {
      angle: -0.6,
      spacing: 1.5,
      alpha: 0.55,
      mask: { from: [cx - w / 2, baseY - h], to: [cx + w / 2, baseY], stops: [[0, 0], [0.45, 0.12], [1, 0.95]] },
    });
    const row = rows[i];
    if (row) {
      // piping ridges curving around the front of each tier
      for (let k = -2; k <= 2; k++) {
        const x = cx + k * row.rx * 0.36 + sk.r(-1, 1);
        const bow = k * 1.6;
        const ridge = new Path(x - bow * 0.3, row.y + row.ry * 0.05).quad(x + bow, row.y + row.ry * 0.55, x + bow * 0.4, row.y + row.ry * 0.92);
        sk.line(ridge, shade, { width: 0.7, alpha: 0.55, passes: 1, overshoot: 0, taper: 0.4 });
      }
    }
    sk.line(s, INK_SOFT, { width: 0.95, alpha: 0.9, overlap: 0.04 });
  });
  return rows;
}

/** A glossy sauce line through points. */
function drizzle(sk, pts, color, width = 1.8) {
  const p = Path.through(pts);
  sk.line(p, color, { width, alpha: 0.95, passes: 1, wobble: 0.25, taper: 0.12, overshoot: 0, grain: 'hard' });
  const shine = Path.through(pts.map(([x, y]) => [x - 0.2, y - width * 0.22]));
  sk.line(shine, '#ffffff', { width: width * 0.3, alpha: 0.45, passes: 1, wobble: 0.2, taper: 0.3, overshoot: 0, grain: null });
}

/** Sauce zigzagging across a cream tier. */
function drizzleRow(sk, cx, y, rx, color, width, waves = 3) {
  const pts = [];
  const n = waves * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = cx - rx + 2 * rx * t;
    const curve = Math.sin(t * PI) * 2.2;
    pts.push([x, y + (i % 2 ? 2.4 : -2.4) + curve]);
  }
  drizzle(sk, pts, color, width);
}

function iceCube(sk, x, y, s, angle, { tint = '#eef6f8', line = '#8fa9b5' } = {}) {
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const r = s * 0.22;
  const p = new Path(0, 0);
  p.pts = [];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    for (let j = 0; j <= 6; j++) {
      const a = (i - 2) * (PI / 2) + (j / 6) * (PI / 2);
      const lx = ax * (s / 2 - r) + Math.cos(a) * r;
      const ly = ay * (s / 2 - r) + Math.sin(a) * r;
      p.pts.push([x + lx * c - ly * sn, y + lx * sn + ly * c]);
    }
  }
  p.close();
  sk.erase(p);
  sk.wash(p, tint, { alpha: 0.85 });
  sk.hatch(p, '#b7cdd6', { angle: angle - 0.6, spacing: 1.5, alpha: 0.5, mask: { from: [x - s / 2, y - s / 2], to: [x + s / 2, y + s / 2], stops: [[0, 0], [1, 1]] } });
  const shine = new Path(x - s * 0.25 * c + s * 0.2 * sn, y - s * 0.25 * sn - s * 0.2 * c).line(x + s * 0.05 * c + s * 0.2 * sn, y + s * 0.05 * sn - s * 0.2 * c);
  sk.line(shine, WHITE, { width: 1.6, passes: 1, grain: null, overshoot: 0 });
  sk.line(p, line, { width: 0.85, alpha: 0.9, overlap: 0.03 });
}

function straw(sk, x0, y0, x1, y1, { w = 5, color = '#f3efe8', stripe = '#e08b8b', line = INK_SOFT } = {}) {
  const center = new Path(x0, y0).line(x1, y1);
  const band = Path.ribbon(center, w);
  sk.erase(band);
  sk.wash(band, color, { alpha: 0.95 });
  if (stripe) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    for (let d = 3; d < len; d += 7) {
      const sx = x0 + ux * d;
      const sy = y0 + uy * d;
      const stripeShape = Path.poly([
        [sx - uy * w * 0.6, sy + ux * w * 0.6],
        [sx - uy * w * 0.6 + ux * 3, sy + ux * w * 0.6 + uy * 3],
        [sx + uy * w * 0.6 + ux * 5, sy - ux * w * 0.6 + uy * 5],
        [sx + uy * w * 0.6 + ux * 2, sy - ux * w * 0.6 + uy * 2],
      ]);
      sk.wash(stripeShape, stripe, { alpha: 0.9, clip: band, offset: [0, 0] });
    }
  }
  sk.hatch(band, '#00000022', { angle: Math.atan2(y1 - y0, x1 - x0), spacing: 1.2, alpha: 0.2 });
  sk.line(band, line, { width: 0.9, overlap: 0.02 });
}

function spoon(sk, x, y, len, angle, { metal = '#d7d3cf', shade = '#9f9893' } = {}) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const bowl = Path.ellipse(x, y, 7.5, 4.4, angle);
  const stem = Path.ribbon(new Path(x + c * 6, y + s * 6).line(x + c * len, y + s * len), 2.2, 3.4);
  for (const p of [stem, bowl]) {
    sk.erase(p);
    sk.wash(p, metal, { alpha: 0.9 });
    sk.hatch(p, shade, { angle: angle + 1.2, spacing: 1.3, alpha: 0.5 });
  }
  sk.line(new Path(x - c * 3, y - s * 3 - 1.2).line(x + c * 2, y + s * 2 - 1.5), WHITE, { width: 1.3, passes: 1, grain: null, overshoot: 0 });
  sk.line(stem, '#6e6762', { width: 0.8, overlap: 0.02 });
  sk.line(bowl, '#6e6762', { width: 0.85 });
}

function steamTrio(sk, cx, y, h = 34, spread = 13) {
  sk.steam(cx - spread, y + 2, h * 0.75);
  sk.steam(cx + 1, y - 2, h);
  sk.steam(cx + spread, y + 3, h * 0.65);
}

function sparkles(sk, list) {
  for (const [x, y, s, color] of list) sk.sparkle(x, y, s, color, { alpha: 0.85 });
}

/** Latte-art heart squashed onto a liquid surface. */
function latteHeart(sk, cx, cy, s, squash = 0.42, color = '#fbf3e6') {
  const p = new Path(cx, cy + s * 0.9 * squash)
    .cubic(cx - s * 1.5, cy + s * 0.1 * squash, cx - s * 1, cy - s * 1.15 * squash, cx, cy - s * 0.35 * squash)
    .cubic(cx + s * 1, cy - s * 1.15 * squash, cx + s * 1.5, cy + s * 0.1 * squash, cx, cy + s * 0.9 * squash)
    .close();
  sk.erase(p);
  sk.wash(p, color, { alpha: 0.95, offset: [0, 0] });
  sk.line(p, '#c49870', { width: 0.6, alpha: 0.5, passes: 1 });
  return p;
}

function strawberrySlice(sk, x, y, s, angle = 0) {
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const tr = (lx, ly) => [x + lx * c - ly * sn, y + lx * sn + ly * c];
  const p = new Path(...tr(0, s))
    .cubic(...tr(-s * 1.15, s * 0.4), ...tr(-s * 0.95, -s * 0.95), ...tr(0, -s * 0.7))
    .cubic(...tr(s * 0.95, -s * 0.95), ...tr(s * 1.15, s * 0.4), ...tr(0, s))
    .close();
  const inner = new Path(...tr(0, s * 0.55))
    .cubic(...tr(-s * 0.6, s * 0.2), ...tr(-s * 0.5, -s * 0.45), ...tr(0, -s * 0.3))
    .cubic(...tr(s * 0.5, -s * 0.45), ...tr(s * 0.6, s * 0.2), ...tr(0, s * 0.55))
    .close();
  sk.erase(p);
  sk.wash(p, '#e5636f', { alpha: 0.95 });
  sk.wash(inner, '#f7c3c3', { alpha: 0.9 });
  sk.hatch(p, '#b8404e', { angle: angle + 0.9, spacing: 1.4, alpha: 0.4, mask: { center: [x, y], r0: s * 0.5, r1: s * 1.1, stops: [[0, 0], [1, 1]] } });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    const [sx, sy] = tr(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55 - s * 0.05);
    sk.dot(sx, sy, 0.7, '#fff2c6', { alpha: 0.95 });
  }
  sk.line(p, '#8e3340', { width: 0.95 });
}

function lavenderSprig(sk, x0, y0, x1, y1) {
  const stem = new Path(x0, y0).quad((x0 + x1) / 2 + 3, (y0 + y1) / 2 - 3, x1, y1);
  sk.line(stem, '#6f8f5a', { width: 1.2, passes: 1 });
  const pts = stem.pts;
  for (let i = Math.floor(pts.length * 0.45); i < pts.length; i += 2) {
    const [x, y] = pts[i];
    for (const side of [-1, 1]) {
      const bud = Path.ellipse(x + side * 2.2, y - 0.5, 2.2, 1.5, side * 0.6 + sk.r(-0.3, 0.3));
      sk.wash(bud, i % 4 ? '#a48ad0' : '#8a6fc0', { alpha: 0.95 });
      sk.line(bud, '#5f4a8c', { width: 0.5, passes: 1, alpha: 0.7 });
    }
  }
}

function biscotti(sk, x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const center = new Path(x - c * 15, y - s * 15).quad(x - s * 2, y + c * 2, x + c * 15, y + s * 15);
  const body = Path.ribbon(center, 9, 8);
  sk.erase(body);
  sk.wash(body, '#e3b77c', { alpha: 0.95 });
  sk.hatch(body, '#b07c45', { angle: angle + 1.3, spacing: 1.3, alpha: 0.5 });
  for (let i = 0; i < 5; i++) {
    const t = -0.7 + i * 0.35;
    const ax = x + c * 15 * t + sk.r(-1.5, 1.5);
    const ay = y + s * 15 * t + sk.r(-1.5, 1.5);
    const nut = Path.ellipse(ax, ay, 2.2, 1.4, angle + sk.r(-1, 1));
    sk.wash(nut, '#f4dfb8', { alpha: 0.95 });
    sk.line(nut, '#9a6a3c', { width: 0.5, passes: 1, alpha: 0.7 });
  }
  sk.line(body, '#7a4f2c', { width: 0.95, overlap: 0.03 });
}

// ------------------------------------------------------------ drinks

const DRAW = {
  espresso(sk) {
    backdrop(sk, '#f3c3ad');
    saucer(sk, 100, 146, 64, 15, { rim: '#eab3a4' });
    shadow(sk, 106, 143, 27, 5.5);
    const { rim, body, outline } = cupShapes(100, 96, 36, 10, 140, 20, 0.55);
    handle(sk, 134, 104, 17);
    paintCupBody(sk, body, 100, 36, 96);
    const band = new Path(63, 103).arc(100, 103, 37, 10, PI, 0).line(137, 108).arc(100, 108, 37, 10, 0, PI).close();
    sk.wash(band, '#e39b8f', { alpha: 0.85, clip: body, offset: [0, 0] });
    sk.erase(rim);
    sk.wash(rim, '#e3d6cb', { alpha: 0.95, offset: [0, 0] });
    const crema = Path.ellipse(100, 98.5, 31, 7.4);
    sk.wash(crema, '#b97a43', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(crema, '#6a3c1f', {
      angle: -0.2,
      spacing: 1.2,
      alpha: 0.75,
      mask: { center: [100, 98.5], r0: 8, r1: 31, stops: [[0, 0], [0.75, 0.6], [1, 1]] },
    });
    sk.wash(Path.ellipse(96, 97.6, 15, 3.2), '#e7b47a', { alpha: 0.8 });
    for (const [x, y] of [[84, 99], [118, 100.5], [112, 96.5], [90, 102]]) sk.dot(x, y, 0.9, '#f6dcc0', { alpha: 0.9 });
    sk.line(outline, INK, { width: 1.2 });
    sk.line(rim, INK, { width: 1.15 });
    sk.line(crema, '#5a341d', { width: 0.7, alpha: 0.7, passes: 1 });
    sk.bean(55, 148, 5.2, 0.5);
    sk.bean(67, 153, 4.8, -0.35);
    steamTrio(sk, 100, 80);
    sparkles(sk, [
      [48, 70, 5, '#d9a24a'],
      [154, 62, 4, '#e0887c'],
      [160, 96, 2.6, '#d9a24a'],
    ]);
  },

  doppio(sk) {
    backdrop(sk, '#efd3a6');
    coaster(sk, 100, 148, 54, 13);
    shadow(sk, 104, 146, 28, 5, '#6b4a33', 0.45);
    const g = glass(100, 80, 30, 8.4, 146, 25);
    sk.erase(g.body);
    sk.erase(g.rim);
    sk.wash(g.body, '#e8f0f0', { alpha: 0.5 });
    const level = 90;
    const coffee = g.liquid(level);
    sk.wash(coffee, '#4a2817', { alpha: 0.95, grain: 'hard' });
    sk.wash(coffee, '#3b1f11', { alpha: 0.6, grain: 'hard' });
    sk.hatch(coffee, '#2a160c', { angle: -1.2, spacing: 1.3, alpha: 0.6, cross: 0.7, grain: 'hard' });
    const cremaBand = g.band(level, level + 13);
    sk.wash(cremaBand, '#b8773d', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(cremaBand, '#7d4a24', { angle: -0.15, spacing: 1.2, alpha: 0.6, mask: { from: [0, level], to: [0, level + 13], stops: [[0, 0], [1, 1]] } });
    const top = g.surface(level, 0.8);
    sk.wash(top, '#d29a5c', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(top, '#8f5528', { angle: -0.1, spacing: 1.3, alpha: 0.6, mask: { center: [100, level], r0: 10, r1: 30, stops: [[0, 0], [1, 1]] } });
    for (const [x, y] of [[88, 89.5], [109, 91], [115, 88.5], [95, 92]]) sk.dot(x, y, 0.8, '#f3d2a8', { alpha: 0.9 });
    paintGlassFront(sk, g, { thickBase: 7 });
    sk.line(top, '#5a341d', { width: 0.6, alpha: 0.6, passes: 1 });
    sk.bean(140, 147, 5, 0.6);
    sk.bean(150, 152, 4.6, -0.2);
    // a sugar cube on the coaster
    const cx = 60;
    const cy = 140;
    const faces = [
      [Path.poly([[cx, cy - 4], [cx + 7, cy - 1], [cx, cy + 2], [cx - 7, cy - 1]]), '#fffdf8', 0.2],
      [Path.poly([[cx - 7, cy - 1], [cx, cy + 2], [cx, cy + 9], [cx - 7, cy + 6]]), '#eee5da', 0.4],
      [Path.poly([[cx, cy + 2], [cx + 7, cy - 1], [cx + 7, cy + 6], [cx, cy + 9]]), '#d9cbbd', 0.6],
    ];
    for (const [face, tint, shade] of faces) {
      sk.erase(face);
      sk.wash(face, tint, { alpha: 1, offset: [0, 0] });
      sk.hatch(face, '#b9a898', { angle: 0.4, spacing: 1.2, alpha: shade });
      sk.line(face, INK_SOFT, { width: 0.7, passes: 1, overshoot: 0.4 });
    }
    steamTrio(sk, 100, 66, 28, 11);
    sparkles(sk, [
      [46, 76, 5, '#d9a24a'],
      [156, 70, 4.2, '#c98a5a'],
      [52, 112, 2.4, '#d9a24a'],
    ]);
  },

  macchiato(sk) {
    backdrop(sk, '#cfe0c2');
    saucer(sk, 100, 148, 60, 14, { rim: '#b4cda5' });
    shadow(sk, 106, 145, 25, 5);
    const sage = { tint: '#c4d8b6', shade: '#7f9d72' };
    const { rim, body, outline } = cupShapes(100, 100, 33, 9.2, 141, 18, 0.55);
    handle(sk, 131, 107, 15, sage);
    paintCupBody(sk, body, 100, 33, 100, sage);
    sk.erase(rim);
    sk.wash(rim, '#dde6d4', { alpha: 0.95, offset: [0, 0] });
    const crema = Path.ellipse(100, 102, 28.5, 6.8);
    sk.wash(crema, '#a8693a', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(crema, '#6a3c1f', { angle: -0.2, spacing: 1.2, alpha: 0.7, mask: { center: [100, 102], r0: 10, r1: 28, stops: [[0, 0], [1, 1]] } });
    sk.line(outline, INK, { width: 1.2 });
    sk.line(rim, INK, { width: 1.1 });
    // a puffy dollop of milk foam, "stained" with a drop of espresso
    const foam = Path.through(
      [
        [78, 103],
        [77, 96],
        [82, 90],
        [88, 88],
        [92, 83],
        [100, 81],
        [107, 83],
        [111, 87],
        [118, 89],
        [123, 96],
        [121, 103],
        [110, 106.5],
        [100, 107],
        [89, 106.5],
      ],
      true,
    );
    sk.erase(foam);
    sk.wash(foam, '#fffaf2', { alpha: 0.95 });
    sk.hatch(foam, '#d4c3b2', { angle: -0.7, spacing: 1.4, alpha: 0.55, mask: { from: [84, 84], to: [120, 108], stops: [[0, 0], [0.5, 0.15], [1, 1]] } });
    for (const [x0, y0, x1, y1] of [[85, 95, 90, 99], [104, 89, 112, 93], [96, 100, 104, 101]]) {
      sk.line(new Path(x0, y0).quad((x0 + x1) / 2, y1 + 1.5, x1, y1), '#cdb9a6', { width: 0.7, alpha: 0.6, passes: 1, overshoot: 0 });
    }
    const stain = Path.through([[94, 90], [98, 87.4], [103, 88], [104, 90.4], [99, 92], [95, 91.8]], true);
    sk.wash(stain, '#a56535', { alpha: 0.85 });
    sk.hatch(stain, '#6e3d1d', { angle: -0.3, spacing: 1, alpha: 0.5 });
    sk.dot(108, 95, 0.7, '#a56535', { alpha: 0.7 });
    sk.dot(90, 96, 0.6, '#a56535', { alpha: 0.6 });
    sk.line(foam, INK_SOFT, { width: 0.95 });
    spoon(sk, 140, 152, 26, -0.25);
    steamTrio(sk, 100, 72, 26, 12);
    sparkles(sk, [
      [50, 74, 4.8, '#8fb47f'],
      [152, 66, 4, '#d9a24a'],
      [158, 102, 2.6, '#8fb47f'],
    ]);
  },

  cappuccino(sk) {
    backdrop(sk, '#f5d7bd');
    saucer(sk, 100, 150, 70, 16, { rim: '#9fb6d1' });
    shadow(sk, 106, 147, 30, 6);
    const blue = { tint: '#d3e0ee', shade: '#8ea4bf' };
    const { rim, body, outline } = cupShapes(100, 98, 45, 12.5, 144, 22, 0.42);
    handle(sk, 141, 106, 16, blue);
    paintCupBody(sk, body, 100, 45, 98, blue);
    sk.erase(rim);
    const foam = Path.ellipse(100, 99.5, 41, 10.8);
    sk.wash(rim, '#e6eef5', { alpha: 0.95, offset: [0, 0] });
    sk.wash(foam, '#c9925c', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(foam, '#8a5428', { angle: -0.15, spacing: 1.2, alpha: 0.65, mask: { center: [100, 99.5], r0: 18, r1: 41, stops: [[0, 0], [0.7, 0.4], [1, 1]] } });
    latteHeart(sk, 100, 100, 16, 0.55);
    const inner = latteHeart(sk, 100, 100.5, 7, 0.5, '#e8c39b');
    void inner;
    for (let i = 0; i < 26; i++) {
      const a = sk.r(0, PI * 2);
      const rr = Math.sqrt(sk.r(0, 1));
      sk.dot(100 + Math.cos(a) * 34 * rr, 99.5 + Math.sin(a) * 8.5 * rr, sk.r(0.4, 0.8), '#5a3320', { alpha: 0.6 });
    }
    sk.line(outline, INK, { width: 1.2 });
    sk.line(rim, INK, { width: 1.1 });
    biscotti(sk, 54, 153, 0.25);
    steamTrio(sk, 100, 78, 28, 16);
    sparkles(sk, [
      [44, 72, 5, '#d9a24a'],
      [158, 70, 4.4, '#8ea4bf'],
      [164, 112, 2.6, '#d9a24a'],
    ]);
  },

  latte(sk) {
    backdrop(sk, '#f0d5b6');
    saucer(sk, 100, 156, 46, 11);
    shadow(sk, 104, 154, 22, 4);
    const g = glass(100, 60, 27, 7.4, 152, 22);
    // a long spoon leaning in the glass: the part above the rim
    spoon(sk, 128, 42, 26, 2.1, { metal: '#d9d5d1' });
    sk.erase(g.body);
    sk.erase(g.rim);
    const level = 66;
    const milk = g.liquid(level);
    sk.wash(milk, '#f1e6d6', { alpha: 0.95 });
    const coffeeBand = g.band(80, 112);
    sk.wash(coffeeBand, '#b98456', { alpha: 0.9, offset: [0, 0], mask: { from: [0, 80], to: [0, 112], stops: [[0, 0.2], [0.3, 1], [1, 0]] } });
    sk.hatch(coffeeBand, '#8a5530', { angle: -0.25, spacing: 1.3, alpha: 0.5, mask: { from: [0, 80], to: [0, 112], stops: [[0, 0], [0.35, 1], [1, 0]] } });
    const foamBand = g.band(level, 80);
    sk.wash(foamBand, '#fffaf2', { alpha: 0.9, offset: [0, 0] });
    sk.hatch(g.band(level, 152), '#cdb9a5', { angle: -1.3, spacing: 1.6, alpha: 0.45, mask: { from: [70, 0], to: [128, 0], stops: [[0, 0], [0.6, 0.1], [1, 1]] } });
    const top = g.surface(level, 0.8);
    sk.wash(top, '#d8ad7f', { alpha: 0.95, offset: [0, 0] });
    // rosetta leaf on the foam
    const leaf = new Path(100, 61.5).cubic(112, 62, 116, 66, 100, 70.6).cubic(84, 66, 88, 62, 100, 61.5).close();
    sk.wash(leaf, '#fffaf0', { alpha: 0.95, offset: [0, 0] });
    for (let i = 0; i < 4; i++) {
      const y = 63 + i * 1.8;
      sk.line(new Path(92 + i * 0.8, y).quad(100, y + 1.6, 108 - i * 0.8, y), '#c79a6c', { width: 0.55, passes: 1, alpha: 0.7, overshoot: 0 });
    }
    paintGlassFront(sk, g, { thickBase: 6 });
    sk.line(top, '#8e6a4c', { width: 0.6, alpha: 0.6, passes: 1 });
    // cinnamon stick on the saucer
    const stick = Path.ribbon(new Path(132, 160).line(156, 150), 4.2);
    sk.erase(stick);
    sk.wash(stick, '#a5643b', { alpha: 0.95 });
    sk.hatch(stick, '#6d3a1f', { angle: -0.4, spacing: 1.1, alpha: 0.6 });
    sk.line(stick, '#5b331c', { width: 0.8 });
    sparkles(sk, [
      [52, 60, 5, '#d9a24a'],
      [150, 92, 4, '#c98a5a'],
      [56, 120, 2.6, '#d9a24a'],
    ]);
  },

  mocha(sk) {
    backdrop(sk, '#ecc9b8');
    shadow(sk, 104, 153, 40, 7, '#7a5a4c', 0.45);
    const blue = { tint: '#b4c8dc', shade: '#6f89a6' };
    const g = glass(100, 100, 34, 9.5, 152, 31);
    handle(sk, 132, 108, 22, { ...blue, w: 8 });
    paintCupBody(sk, g.body, 100, 34, 100, blue);
    // a little heart doodle on the mug
    sk.heart(90, 128, 5.2, '#c0686f', { fill: '#efa3a7' });
    sk.erase(g.rim);
    sk.wash(g.rim, '#5d3220', { alpha: 0.95, offset: [0, 0] });
    sk.line(g.outline, INK, { width: 1.2 });
    sk.line(g.rim, INK, { width: 1.1 });
    const rows = whippedCream(sk, 100, 104, 74, 44);
    rows.forEach((row, i) => drizzleRow(sk, 100, row.y - row.ry * 0.1, row.rx * 0.82, '#5b3220', 1.9 - i * 0.2, 3 - (i > 1 ? 1 : 0)));
    for (let i = 0; i < 10; i++) {
      const x = sk.r(78, 122);
      const y = sk.r(64, 98);
      const sh = new Path(x, y).quad(x + 1.4, y - 1.6, x + 2.8, y + 0.4);
      sk.line(sh, '#3d2014', { width: 1.2, passes: 1, overshoot: 0, grain: 'hard' });
    }
    sparkles(sk, [
      [48, 70, 5, '#d9a24a'],
      [152, 62, 4.4, '#c0686f'],
      [160, 100, 2.6, '#d9a24a'],
    ]);
  },

  iced_latte(sk) {
    backdrop(sk, '#cde1ea');
    coaster(sk, 100, 160, 44, 10.5, { wood: '#d9b58a', dark: '#a87e55', thick: 4 });
    shadow(sk, 104, 158, 24, 4, '#6b5a4c', 0.4);
    const g = glass(100, 52, 31, 8.4, 156, 25);
    sk.erase(g.body);
    sk.erase(g.rim);
    const level = 64;
    const milk = g.liquid(level);
    sk.wash(milk, '#f0e5d6', { alpha: 0.95 });
    // coffee clouding down into the milk
    const fade = { from: [0, 64], to: [0, 140], stops: [[0, 1], [0.3, 0.85], [1, 0]] };
    sk.wash(g.band(64, 90), '#a26b44', { alpha: 0.9, offset: [0, 0], mask: { from: [0, 70], to: [0, 92], stops: [[0, 1], [1, 0.4]] } });
    for (const [x, sway, len, w] of [[80, 5, 64, 7], [96, -6, 52, 9], [113, 4, 70, 6], [104, 6, 38, 5]]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push([x + Math.sin(i * 0.9 + x) * sway, 80 + (len * i) / 6]);
      const tendril = Path.ribbon(Path.through(pts), w, 1);
      sk.wash(tendril, '#a26b44', { alpha: 0.7, clip: milk, mask: fade });
      sk.hatch(tendril, '#6e4026', { angle: -0.6, spacing: 1.3, alpha: 0.45, clip: milk, mask: fade });
    }
    const top = g.surface(level, 0.8);
    sk.wash(top, '#a8724a', { alpha: 0.95, offset: [0, 0] });
    iceCube(sk, 88, 66, 17, 0.25);
    iceCube(sk, 111, 63, 16, -0.3);
    iceCube(sk, 100, 78, 15, 0.1, { tint: '#e7d9c8', line: '#9a8a7a' });
    straw(sk, 108, 96, 132, 28, { stripe: '#e39a8f' });
    paintGlassFront(sk, g, { thickBase: 6 });
    for (const [x, y, r] of [[80, 112, 1.6], [118, 120, 1.3], [84, 134, 1.2], [116, 98, 1.1], [122, 140, 1.4]]) {
      const drop = Path.ellipse(x, y, r * 0.8, r * 1.2);
      sk.line(drop, '#8fa9b5', { width: 0.55, passes: 1 });
      sk.dot(x - r * 0.25, y - r * 0.35, r * 0.35, WHITE, { alpha: 1, grain: null });
    }
    sparkles(sk, [
      [52, 58, 5, '#8fb6c9'],
      [152, 84, 4.2, '#d9a24a'],
      [48, 112, 2.6, '#8fb6c9'],
    ]);
  },

  matcha_frappe(sk) {
    frappe(sk, {
      backdrop: '#d6e7c6',
      drink: '#a7c97a',
      drinkShade: '#6e9a49',
      speck: '#e9f2dc',
      straw: '#8dbb74',
      strawStripe: null,
      topping: (cx, rows) => {
        for (const row of rows) {
          for (let i = 0; i < 16; i++) {
            const a = sk.r(PI, PI * 2);
            const rr = Math.sqrt(sk.r(0.1, 1));
            sk.dot(cx + Math.cos(a) * row.rx * 0.85 * rr, row.y + Math.sin(a) * row.ry * 0.7 * rr, sk.r(0.35, 0.75), '#6f9a49', { alpha: 0.85 });
          }
        }
        sk.line(new Path(140, 56).quad(146, 50, 152, 52), '#6f9a49', { width: 1.1, passes: 1 });
        const leaf = new Path(152, 52).quad(160, 44, 166, 48).quad(160, 56, 152, 52).close();
        sk.wash(leaf, '#9cc47e', { alpha: 0.9 });
        sk.line(leaf, '#58803e', { width: 0.8 });
      },
      sparkle: '#8fb47f',
    });
  },

  caramel_frappe(sk) {
    frappe(sk, {
      backdrop: '#f2d8ae',
      drink: '#d9a46a',
      drinkShade: '#a8692f',
      speck: '#f6e3c8',
      straw: '#f3efe8',
      strawStripe: '#d58f45',
      wallDrizzle: '#9a5a22',
      topping: (cx, rows) => {
        rows.forEach((row, i) => drizzleRow(sk, cx, row.y - row.ry * 0.1, row.rx * 0.8, '#b06a2a', 1.9 - i * 0.25, i > 1 ? 2 : 3));
      },
      sparkle: '#d9a24a',
    });
  },

  affogato(sk) {
    backdrop(sk, '#f2e1c2');
    saucer(sk, 100, 152, 56, 13.5, { rim: '#e8cf9f' });
    shadow(sk, 104, 149, 28, 5);
    const g = glass(100, 106, 33, 9, 146, 22);
    sk.erase(g.body);
    sk.erase(g.rim);
    sk.wash(g.body, '#eef3f3', { alpha: 0.4 });
    const pool = g.liquid(126);
    sk.wash(pool, '#4d2a17', { alpha: 0.95, grain: 'hard' });
    sk.wash(pool, '#3b1f11', { alpha: 0.5, grain: 'hard' });
    sk.hatch(pool, '#2b170c', { angle: -1.1, spacing: 1.3, alpha: 0.55, grain: 'hard' });
    sk.wash(g.surface(126, 0.8), '#7c4a28', { alpha: 0.9, offset: [0, 0] });
    paintGlassFront(sk, g, { thickBase: 5 });
    // a wafer roll tucked behind the scoop
    const wafer = Path.ribbon(new Path(118, 104).line(140, 60), 7);
    sk.erase(wafer);
    sk.wash(wafer, '#e8bf7f', { alpha: 0.95 });
    for (let t = 0.1; t < 1; t += 0.16) {
      const x = 118 + 22 * t;
      const y = 104 - 44 * t;
      sk.line(new Path(x - 3.6, y - 1.4).line(x + 3.6, y + 1.8), '#b07c45', { width: 0.7, passes: 1, overshoot: 0 });
    }
    sk.line(wafer, '#8a5a2e', { width: 0.85 });
    // vanilla scoop with espresso poured over the top
    const scoop = Path.through(
      [
        [69, 106],
        [68, 92],
        [76, 78],
        [90, 69],
        [104, 67],
        [119, 72],
        [129, 84],
        [131, 98],
        [128, 107],
        [121, 110],
        [114, 108],
        [107, 112],
        [99, 109],
        [91, 112],
        [83, 109],
        [75, 111],
      ],
      true,
    );
    sk.erase(scoop);
    sk.wash(scoop, '#fff5df', { alpha: 0.95 });
    sk.hatch(scoop, '#e0c99e', { angle: -0.7, spacing: 1.4, alpha: 0.6, mask: { from: [78, 70], to: [128, 112], stops: [[0, 0], [0.45, 0.1], [1, 1]] } });
    // the espresso cap with drips running down the sides
    const cap = Path.through(
      [
        [70, 86],
        [78, 74],
        [92, 66],
        [108, 66],
        [122, 73],
        [130, 86],
        [126, 92],
        [123, 102],
        [119, 90],
        [112, 92],
        [108, 99],
        [104, 92],
        [95, 94],
        [90, 104],
        [86, 93],
        [78, 92],
        [74, 97],
      ],
      true,
    );
    sk.wash(cap, '#7d4626', { alpha: 0.95, clip: scoop, offset: [0, 0], grain: 'hard' });
    sk.hatch(cap, '#4a2614', { angle: -1.1, spacing: 1.2, alpha: 0.55, clip: scoop, mask: { from: [0, 64], to: [0, 104], stops: [[0, 1], [1, 0.2]] } });
    sk.line(new Path(86, 72).quad(96, 68, 106, 69), '#d9a77a', { width: 1.6, alpha: 0.8, passes: 1, overshoot: 0, grain: null });
    for (const [x, y] of [[80, 100], [100, 101], [117, 104], [94, 107]]) sk.dot(x, y, 0.6, '#3d2416', { alpha: 0.6 });
    sk.line(scoop, INK_SOFT, { width: 1 });
    spoon(sk, 146, 156, 22, -0.2);
    sparkles(sk, [
      [48, 70, 5, '#d9a24a'],
      [154, 92, 4, '#c98a5a'],
      [52, 112, 2.6, '#d9a24a'],
    ]);
  },

  lavender_latte(sk) {
    backdrop(sk, '#ddd2ec');
    saucer(sk, 100, 150, 64, 15, { rim: '#c8b6e2' });
    shadow(sk, 106, 147, 27, 5.5);
    const lilac = { tint: '#d9cdea', shade: '#9784b8' };
    const { rim, body, outline } = cupShapes(100, 98, 39, 10.8, 143, 21, 0.5);
    handle(sk, 136, 106, 16, lilac);
    paintCupBody(sk, body, 100, 39, 98, lilac);
    sk.erase(rim);
    sk.wash(rim, '#ece6f3', { alpha: 0.95, offset: [0, 0] });
    const foam = Path.ellipse(100, 99.5, 35.5, 9.2);
    sk.wash(foam, '#d9c3df', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(foam, '#a37fae', { angle: -0.2, spacing: 1.3, alpha: 0.55, mask: { center: [100, 99.5], r0: 14, r1: 35, stops: [[0, 0], [1, 1]] } });
    latteHeart(sk, 100, 100, 13, 0.55, '#fbf6fb');
    for (let i = 0; i < 9; i++) sk.dot(sk.r(78, 122), sk.r(95, 104), 0.8, '#7d5fb0', { alpha: 0.8 });
    sk.line(outline, INK, { width: 1.2 });
    sk.line(rim, INK, { width: 1.1 });
    lavenderSprig(sk, 140, 158, 168, 134);
    lavenderSprig(sk, 146, 160, 164, 128);
    steamTrio(sk, 100, 78, 28, 14);
    sparkles(sk, [
      [46, 70, 5, '#a48ad0'],
      [154, 62, 4.2, '#d9a24a'],
      [44, 112, 2.6, '#a48ad0'],
    ]);
  },

  strawberry_matcha(sk) {
    backdrop(sk, '#f5d0d4');
    coaster(sk, 100, 160, 44, 10.5, { wood: '#f2c9cf', dark: '#d79aa3', thick: 4 });
    shadow(sk, 104, 158, 24, 4, '#8a5a60', 0.35);
    const g = glass(100, 54, 30, 8.2, 156, 25);
    sk.erase(g.body);
    sk.erase(g.rim);
    const level = 66;
    sk.wash(g.liquid(level), '#a9c97c', { alpha: 0.95 });
    sk.hatch(g.liquid(level), '#6e9a49', { angle: -1.2, spacing: 1.4, alpha: 0.45 });
    const milk = g.band(92, 156);
    sk.erase(milk);
    sk.wash(milk, '#fbf6ee', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(g.band(88, 98), '#a9c97c', { angle: -0.2, spacing: 1.3, alpha: 0.5, mask: { from: [0, 88], to: [0, 98], stops: [[0, 1], [1, 0]] } });
    const berry = g.band(118, 156);
    sk.erase(berry);
    sk.wash(berry, '#f2a4ae', { alpha: 0.95, offset: [0, 0] });
    sk.hatch(g.band(112, 124), '#f2a4ae', { angle: -0.2, spacing: 1.3, alpha: 0.6, mask: { from: [0, 112], to: [0, 124], stops: [[0, 0], [1, 1]] } });
    for (let i = 0; i < 14; i++) {
      const bit = Path.ellipse(sk.r(80, 120), sk.r(126, 150), sk.r(1.4, 2.6), sk.r(1, 1.8), sk.r(0, PI));
      sk.wash(bit, '#d84f60', { alpha: 0.85 });
    }
    sk.hatch(g.band(level, 156), '#7f7266', { angle: -1.3, spacing: 1.6, alpha: 0.35, mask: { from: [70, 0], to: [130, 0], stops: [[0, 0], [0.6, 0.05], [1, 1]] } });
    sk.wash(g.surface(level, 0.8), '#bcd78f', { alpha: 0.95, offset: [0, 0] });
    iceCube(sk, 88, 68, 15, 0.3);
    iceCube(sk, 110, 66, 14, -0.25);
    straw(sk, 104, 98, 128, 26, { stripe: '#e57f8d' });
    paintGlassFront(sk, g, { thickBase: 6 });
    strawberrySlice(sk, 72, 54, 10, -0.5);
    sk.heart(150, 64, 4.4, '#d8707e', { fill: '#f4a9b3' });
    sparkles(sk, [
      [52, 92, 4.6, '#e57f8d'],
      [154, 100, 4.2, '#8fb47f'],
      [146, 40, 2.6, '#d9a24a'],
    ]);
  },
};

/** The plastic dome-lid cup shared by the frappés. */
function frappe(sk, o) {
  backdrop(sk, o.backdrop);
  shadow(sk, 104, 160, 30, 5.5, '#6b5a4c', 0.4);
  const g = glass(100, 92, 33, 8.8, 158, 24);
  // straw first: the lid and cream cover its lower part
  straw(sk, 104, 64, 124, 20, { w: 7, color: o.straw, stripe: o.strawStripe, line: '#4f6a43' });
  sk.erase(g.body);
  sk.erase(g.rim);
  const level = 96;
  const drink = g.liquid(level);
  sk.wash(drink, o.drink, { alpha: 0.95 });
  sk.hatch(drink, o.drinkShade, { angle: -1.15, spacing: 1.5, alpha: 0.5, cross: 0.8 });
  for (let i = 0; i < 40; i++) sk.dot(sk.r(80, 120), sk.r(100, 152), sk.r(0.5, 1.1), o.speck, { alpha: 0.9 });
  if (o.wallDrizzle) {
    // sauce running down the inside of the cup in soft loops
    for (const [x, len] of [[79, 34], [92, 46], [107, 28], [119, 40]]) {
      const pts = [];
      for (let y = 98; y <= 98 + len; y += 7) pts.push([x + Math.sin(y * 0.21 + x) * 2.2, y]);
      sk.line(Path.through(pts), o.wallDrizzle, { width: 1.5, alpha: 0.7, passes: 1, overshoot: 0, taper: 0.3 });
    }
  }
  sk.hatch(g.band(level, 158), '#7f7266', { angle: -1.3, spacing: 1.6, alpha: 0.35, mask: { from: [70, 0], to: [130, 0], stops: [[0, 0], [0.6, 0.05], [1, 1]] } });
  paintGlassFront(sk, g, { lineColor: '#7a8a8e' });
  // dome lid with whipped cream inside
  const domeTop = 50;
  const dome = new Path(100 - 34, 92).cubic(100 - 34, 70, 100 - 22, domeTop, 100, domeTop).cubic(100 + 22, domeTop, 100 + 34, 70, 100 + 34, 92).arc(100, 92, 34, 9, 0, PI).close();
  sk.erase(dome);
  sk.wash(dome, '#eef4f4', { alpha: 0.35 });
  const rows = whippedCream(sk, 100, 94, 60, 38, { shade: '#d7c9b8' });
  o.topping(100, rows);
  // the straw shows through the clear dome
  straw(sk, 109, 56, 124, 20, { w: 7, color: o.straw, stripe: o.strawStripe, line: '#4f6a43' });
  sk.line(dome, '#7a8a8e', { width: 1, alpha: 0.85 });
  const lip = new Path(100 - 35.5, 92).arc(100, 92, 35.5, 9.6, PI, 0);
  sk.line(lip, '#7a8a8e', { width: 1.4, alpha: 0.9 });
  sk.line(new Path(78, 64).quad(72, 76, 72, 86), WHITE, { width: 2.6, passes: 1, grain: null, overshoot: 0, alpha: 0.9 });
  sparkles(sk, [
    [44, 64, 5, o.sparkle],
    [156, 92, 4.2, '#d9a24a'],
    [48, 116, 2.6, o.sparkle],
  ]);
}

export const DRAWING_IDS = Object.keys(DRAW);

const cache = new Map();

/**
 * Render a drink at `px` device pixels (square). Results are cached.
 * options.backdrop draws the pastel disc; options.mono renders a graphite-only sketch.
 */
export function renderCoffee(id, px, { backdrop: withBackdrop = true, mono = false } = {}) {
  const key = `${id}@${Math.round(px)}:${withBackdrop ? 1 : 0}${mono ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key);
  const sk = new Sketch(px, hashString(id));
  sk.backdrop = withBackdrop;
  sk.mono = mono;
  (DRAW[id] || DRAW.espresso)(sk);
  cache.set(key, sk.canvas);
  return sk.canvas;
}
