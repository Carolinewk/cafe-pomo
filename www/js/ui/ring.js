// The pomodoro ring, drawn in colored pencil. The track and the colored band are
// rendered once per size and phase; each frame only clips the band to the progress.

import { Sketch, Path, Shape, makeCanvas } from '../art/pencil.js';

export const PHASE_COLORS = {
  focus: { band: '#e48b72', deep: '#bf5f49', bean: '#7a4a2e' },
  short: { band: '#93bd84', deep: '#5f8f51', bean: '#7a4a2e' },
  long: { band: '#98aed6', deep: '#6680b3', bean: '#7a4a2e' },
};

const R = 88; // band centre radius in the 200-unit drawing space
const BAND = 7;

export class Ring {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layers = new Map();
    this.px = 0;
  }

  resize(cssSize) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const px = Math.round(cssSize * dpr);
    this.canvas.style.width = `${cssSize}px`;
    this.canvas.style.height = `${cssSize}px`;
    if (px === this.px) return;
    this.px = px;
    this.canvas.width = px;
    this.canvas.height = px;
    this.layers.clear();
  }

  layer(kind, phase) {
    const key = `${kind}:${phase}`;
    if (this.layers.has(key)) return this.layers.get(key);
    let canvas;
    if (kind === 'track') canvas = renderTrack(this.px);
    else if (kind === 'band') canvas = renderBand(this.px, phase);
    else canvas = renderBean(Math.round(this.px * 0.09));
    this.layers.set(key, canvas);
    return canvas;
  }

  draw(phase, p) {
    const g = this.ctx;
    const { px } = this;
    if (!px) return;
    g.clearRect(0, 0, px, px);
    g.drawImage(this.layer('track', 'any'), 0, 0);
    const c = px / 2;
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * p;
    if (p > 0.001) {
      g.save();
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, px * 0.5, start, end);
      g.closePath();
      g.clip();
      g.drawImage(this.layer('band', phase), 0, 0);
      g.restore();
    }
    // a coffee bean rides the tip of the band
    const bean = this.layer('bean', 'any');
    const k = px / 200;
    const bx = c + Math.cos(end) * R * k;
    const by = c + Math.sin(end) * R * k;
    g.save();
    g.translate(bx, by);
    g.rotate(end + Math.PI / 2);
    g.drawImage(bean, -bean.width / 2, -bean.height / 2);
    g.restore();
  }
}

function renderTrack(px) {
  const sk = new Sketch(px, 31);
  const outer = Path.ellipse(100, 100, R + BAND / 2, R + BAND / 2);
  const inner = Path.ellipse(100, 100, R - BAND / 2, R - BAND / 2);
  sk.hatch(new Shape(outer, inner), '#cdb9a7', { angle: 0.7, spacing: 1.8, alpha: 0.5, width: 0.7 });
  sk.line(outer, '#9a8273', { width: 0.8, alpha: 0.55, overlap: 0.04 });
  sk.line(inner, '#9a8273', { width: 0.7, alpha: 0.45, overlap: 0.04 });
  // tick marks every five minutes of a 60-minute dial
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r0 = R - BAND / 2 - 3.5;
    const r1 = R - BAND / 2 - (i % 3 === 0 ? 8 : 5.5);
    const tick = new Path(100 + Math.cos(a) * r0, 100 + Math.sin(a) * r0).line(100 + Math.cos(a) * r1, 100 + Math.sin(a) * r1);
    sk.line(tick, '#9a8273', { width: i % 3 === 0 ? 1.1 : 0.8, alpha: 0.6, passes: 1, overshoot: 0 });
  }
  return sk.canvas;
}

function renderBand(px, phase) {
  const col = PHASE_COLORS[phase] || PHASE_COLORS.focus;
  const sk = new Sketch(px, phase.length * 97);
  const outer = Path.ellipse(100, 100, R + BAND / 2 + 0.6, R + BAND / 2 + 0.6);
  const inner = Path.ellipse(100, 100, R - BAND / 2 - 0.6, R - BAND / 2 - 0.6);
  const band = new Shape(outer, inner);
  sk.wash(band, col.band, { alpha: 0.7, offset: [0, 0] });
  sk.hatch(band, col.band, { angle: -0.8, spacing: 1.2, alpha: 0.75, width: 1, offset: [0, 0] });
  sk.hatch(band, col.deep, { angle: 0.9, spacing: 2.2, alpha: 0.35, width: 0.8, offset: [0, 0] });
  sk.line(Path.ellipse(100, 100, R + BAND / 2, R + BAND / 2), col.deep, { width: 0.9, alpha: 0.75, overlap: 0.03 });
  sk.line(Path.ellipse(100, 100, R - BAND / 2, R - BAND / 2), col.deep, { width: 0.8, alpha: 0.6, overlap: 0.03 });
  return sk.canvas;
}

function renderBean(px) {
  // drawn with heavy strokes: at icon size the usual pencil weights would vanish
  const sk = new Sketch(Math.max(16, px), 5);
  const body = Path.ellipse(100, 100, 58, 84);
  sk.wash(body, '#9a6239', { alpha: 0.95, grain: 'hard' });
  sk.hatch(body, '#4a2a18', { angle: 0.6, spacing: 10, width: 6, alpha: 0.45, grain: 'hard' });
  sk.line(new Path(100, 24).cubic(72, 72, 128, 128, 100, 176), '#2c1a12', { width: 11, passes: 1, overshoot: 0, wobble: 1.5 });
  sk.line(body, '#3a2418', { width: 10, passes: 1, wobble: 1.5 });
  const c = makeCanvas(sk.px, sk.px);
  c.getContext('2d').drawImage(sk.canvas, 0, 0);
  return c;
}
