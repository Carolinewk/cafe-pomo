// The living cafe: barista, customers, the cat and little effects, all pixel art.
// The scene draws onto a low-resolution canvas that CSS scales up with crisp pixels.

import { drawBackground, buildProps, ROOM_W, OX, OY, TABLES, STOOLS, CAT, W, D, OUT, LIGHTS } from './room.js';
import { frame, ANCHOR, BARISTA, randomLook } from './chars.js';
import { depthSort } from './iso.js';
import { textSprite } from './pixel.js';
import { drawText, textWidth } from './pixfont.js';
import { mulberry32 } from '../art/rng.js';

const SPEED = 13; // world units per second
const CELL = 2;
const DOOR = [50.5, 1];
const REGISTER = [9, 8];
const MACHINE = [9, 15.5];
const QUEUE = [
  [23, 8],
  [23, 14],
  [24, 20],
  [27, 26],
];
const ICED = new Set(['iced_latte', 'matcha_frappe', 'caramel_frappe', 'affogato', 'strawberry_matcha']);
const DIRS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// ---------------------------------------------------------------- the cat

const CAT_PAL = { o: OUT, f: '#f6cf9f', F: '#e2a86e', w: '#fff6ea', p: '#f2a7a0', e: OUT };
const CAT_SPRITES = {
  // curled up asleep; the second frame breathes in
  sleep: [
    [
      '...............',
      '..o.o..........',
      '.opoopo........',
      '.offffo.ooooo..',
      'offffffoffFfFo.',
      'ofeffeffffffffo',
      'ofwwffffFffFffo',
      '.offffffffffffo',
      '.oooooFFFFFffo.',
      '......ooooooo..',
    ],
    [
      '..o.o..........',
      '.opoopo........',
      '.offffo.ooooo..',
      'offffffoffFfFo.',
      'offffffffffffffo',
      'ofeffefffffffffo',
      'ofwwffffFffFfffo',
      '.offffffffffffo.',
      '.oooooFFFFFfffo.',
      '......oooooooo..',
    ],
  ],
  // sitting up during breaks, tail flicking
  sit: [
    [
      '.o...o....',
      'opo.opo...',
      'offoffo...',
      'offffffo..',
      'ofefefo...',
      'ofwpwfo...',
      '.offfo....',
      '.offffo...',
      'offFfffo..',
      'offFffffoo',
      'offwwffofo',
      '.ooooooofo',
      '.......oo.',
    ],
    [
      '.o...o....',
      'opo.opo...',
      'offoffo...',
      'offffffo..',
      'ofefefo...',
      'ofwpwfo...',
      '.offfo....',
      '.offffo.oo',
      'offFfffoof',
      'offFffffoo',
      'offwwffo..',
      '.ooooooo..',
      '..........',
    ],
  ],
};
for (const k of Object.keys(CAT_SPRITES)) CAT_SPRITES[k] = CAT_SPRITES[k].map((rows) => textSprite(rows, CAT_PAL).toCanvas());

// ---------------------------------------------------------------- navigation

function blockedFor(who) {
  return (x, y) => {
    if (x < 1.5 || y < 1.5 || x > W - 1.5 || y > D - 1.5) return !(y < 3 && y > -1 && x > 47 && x < 54);
    if (x < 7) return true; // back counter
    if (x > 10.5 && x < 19.5 && y < 32) return true; // front counter
    if (who === 'customer' && x < 19.5) return true;
    if (y < 4.5 && x > 23 && x < 47) return true; // window ledge
    for (const t of TABLES) {
      if (Math.hypot(x - t.x, y - t.y) < 5.2) return true;
      for (const s of t.seats) if (Math.abs(x - s.x) < 3.4 && Math.abs(y - s.y) < 3.4) return true;
    }
    for (const s of STOOLS) if (Math.abs(x - s.x) < 3.4 && Math.abs(y - s.y) < 3.4) return true;
    if (Math.hypot(x - 5, y - 43) < 6) return true;
    if (Math.hypot(x - 53, y - 21) < 5) return true;
    if (Math.hypot(x - CAT.x, y - CAT.y) < 5.5) return true;
    return false;
  };
}

class Grid {
  constructor(blocked) {
    this.w = Math.round(W / CELL);
    this.h = Math.round(D / CELL);
    this.solid = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) this.solid[j * this.w + i] = blocked(i * CELL + CELL / 2, j * CELL + CELL / 2) ? 1 : 0;
    }
  }

  free(i, j) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.solid[j * this.w + i];
  }

  nearest(x, y) {
    const i0 = Math.floor(x / CELL);
    const j0 = Math.floor(y / CELL);
    for (let r = 0; r < 8; r++) {
      let best = null;
      let bd = Infinity;
      for (let j = j0 - r; j <= j0 + r; j++) {
        for (let i = i0 - r; i <= i0 + r; i++) {
          if (!this.free(i, j)) continue;
          const d = Math.hypot(i * CELL + CELL / 2 - x, j * CELL + CELL / 2 - y);
          if (d < bd) {
            bd = d;
            best = [i, j];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  clear(x0, y0, x1, y1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.5));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      if (!this.free(Math.floor((x0 + (x1 - x0) * t) / CELL), Math.floor((y0 + (y1 - y0) * t) / CELL))) return false;
    }
    return true;
  }

  /** A* over the grid, then string-pulled into a few straight segments. */
  path(x0, y0, x1, y1) {
    const s = this.nearest(x0, y0);
    const g = this.nearest(x1, y1);
    if (!s || !g) return [[x1, y1]];
    const n = this.w * this.h;
    const key = (i, j) => j * this.w + i;
    const cost = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const hx = (i, j) => {
      const dx = Math.abs(i - g[0]);
      const dy = Math.abs(j - g[1]);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const open = [[s[0], s[1], hx(s[0], s[1])]];
    cost[key(s[0], s[1])] = 0;
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][2] < open[bi][2]) bi = k;
      const [i, j] = open[bi];
      open.splice(bi, 1);
      const kc = key(i, j);
      if (closed[kc]) continue;
      closed[kc] = 1;
      if (i === g[0] && j === g[1]) break;
      for (const [di, dj] of DIRS8) {
        const ni = i + di;
        const nj = j + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(i + di, j) || !this.free(i, j + dj))) continue;
        const nk = key(ni, nj);
        if (closed[nk]) continue;
        const c = cost[kc] + (di && dj ? 1.414 : 1);
        if (c < cost[nk]) {
          cost[nk] = c;
          came[nk] = kc;
          open.push([ni, nj, c + hx(ni, nj)]);
        }
      }
    }
    const gk = key(g[0], g[1]);
    if (!closed[gk]) return [[x1, y1]];
    const cells = [];
    for (let k = gk; k !== -1; k = came[k]) cells.push([(k % this.w) * CELL + CELL / 2, Math.floor(k / this.w) * CELL + CELL / 2]);
    cells.reverse();
    const pts = [[x0, y0], ...cells, [x1, y1]];
    const out = [];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.clear(pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b--;
      out.push(pts[b]);
      a = b;
    }
    return out;
  }
}

// ---------------------------------------------------------------- people

class Person {
  constructor(look) {
    this.look = look;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.dir = 'front';
    this.flip = false;
    this.pose = 'stand';
    this.path = [];
    this.walkT = 0;
    this.cup = null;
    this.state = 'idle';
    this.timer = 0;
    this.seat = null;
    this.sitting = false;
  }

  go(path) {
    this.path = path.slice();
  }

  /** Walk along the current path; returns true once there is nowhere left to go. */
  move(dt) {
    if (!this.path.length) {
      this.pose = this.sitting ? 'sit' : 'stand';
      return true;
    }
    let budget = SPEED * dt;
    while (budget > 0 && this.path.length) {
      const [tx, ty] = this.path[0];
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01) this.face(dx, dy);
      if (d <= budget) {
        this.x = tx;
        this.y = ty;
        this.path.shift();
        budget -= d;
      } else {
        this.x += (dx / d) * budget;
        this.y += (dy / d) * budget;
        budget = 0;
      }
    }
    this.walkT += dt;
    this.pose = this.path.length ? ['walk1', 'stand', 'walk2', 'stand'][Math.floor(this.walkT * 7) % 4] : 'stand';
    return !this.path.length;
  }

  face(dx, dy) {
    const vx = 2 * (dx - dy);
    const vy = dx + dy;
    if (Math.abs(vx) + Math.abs(vy) < 1e-6) return;
    this.dir = vy >= 0 ? 'front' : 'back';
    this.flip = this.dir === 'front' ? vx < 0 : vx > 0;
  }

  sitOn(seat) {
    this.sitting = true;
    this.x = seat.x;
    this.y = seat.y;
    this.z = seat.z;
    this.dir = seat.dir;
    this.flip = seat.flip;
    this.pose = 'sit';
  }

  standUp() {
    this.sitting = false;
    this.z = 0;
    this.pose = 'stand';
  }

  drawable(rx, ry) {
    const r = frame(this.look, this.dir, this.pose, this.sitting ? null : this.cup);
    const canvas = (r._canvas ||= r.toCanvas());
    const sx = Math.round(rx + OX + 2 * (this.x - this.y) - ANCHOR.x);
    const sy = Math.round(ry + OY + (this.x + this.y) - this.z - ANCHOR.y);
    const box = this.sitting
      ? { x0: this.x - 2.39, x1: this.x + 2.41, y0: this.y - 2.39, y1: this.y + 2.41, z0: 8, z1: 40 }
      : { x0: this.x - 1.4, x1: this.x + 1.4, y0: this.y - 1.4, y1: this.y + 1.4, z0: this.z, z1: this.z + 28 };
    const flip = this.flip;
    return {
      box,
      rect: { x0: sx, y0: sy, x1: sx + r.w, y1: sy + r.h },
      head: [sx + ANCHOR.x, sy + 2],
      draw(g) {
        if (flip) {
          g.save();
          g.translate(sx + r.w, sy);
          g.scale(-1, 1);
          g.drawImage(canvas, 0, 0);
          g.restore();
        } else g.drawImage(canvas, sx, sy);
      },
    };
  }
}

// ---------------------------------------------------------------- the cafe

export class Cafe {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rand = mulberry32((Date.now() & 0xffffff) ^ 0x9e3779b9);
    this.t = 0;
    this.hour = new Date().getHours();
    this.menu = [];
    this.bg = drawBackground(this.hour, this.menu).toCanvas();
    this.props = buildProps().map((p) => ({ ...p, canvas: p.raster.toCanvas() }));
    this.custGrid = new Grid(blockedFor('customer'));
    this.staffGrid = new Grid(blockedFor('staff'));
    this.seats = [
      ...TABLES.flatMap((t) =>
        t.seats.map((s) => ({
          x: s.x,
          y: s.y,
          z: 5,
          dir: 'front',
          flip: s.facing === 'S',
          approach: s.facing === 'E' ? [s.x, s.y + 4.6] : [s.x + 4.6, s.y],
          cupAt: [s.x + (t.x - s.x) * 0.5, s.y + (t.y - s.y) * 0.5, 13],
          who: null,
        })),
      ),
      ...STOOLS.map((s) => ({ x: s.x, y: s.y, z: 8, dir: 'back', flip: true, approach: [s.x, s.y + 4.6], cupAt: [s.x, 1.8, 19], who: null })),
    ];
    this.customers = [];
    this.queue = [];
    this.particles = [];
    this.tableCups = [];
    this.barista = new Person(BARISTA);
    [this.barista.x, this.barista.y] = REGISTER;
    this.barista.face(1, 0);
    this.phase = 'focus';
    this.status = 'idle';
    this.coffee = null;
    this.spawnIn = 2;
    this.served = 0;
    this.onServe = null;
    this.scale = 2;
    this.roomX = 0;
    this.roomY = 0;
  }

  /**
   * Size the art canvas to cover `cssW` x `cssH` CSS pixels with one art pixel per `px`
   * CSS pixels, and put the top of the room raster at `roomTopCss`.
   */
  layout(cssW, cssH, roomTopCss, px = cssW / ROOM_W) {
    this.scale = px;
    const w = Math.ceil(cssW / px);
    const h = Math.ceil(cssH / px);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.canvas.style.width = `${w * px}px`;
    this.canvas.style.height = `${h * px}px`;
    this.canvas.style.left = `${(cssW - w * px) / 2}px`;
    this.roomX = Math.floor((w - ROOM_W) / 2);
    this.roomY = Math.round(roomTopCss / px);
  }

  setCoffee(coffee) {
    this.coffee = coffee;
  }

  /** The unlocked drinks: written on the chalkboard, and a longer menu draws more customers. */
  setMenu(coffees) {
    const key = coffees.map((c) => c.id).join(',');
    if (key === this.menuKey) return;
    this.menuKey = key;
    this.menu = coffees.map((c) => c.cup);
    this.bg = drawBackground(this.hour, this.menu).toCanvas();
  }

  /** True when nothing moves except the ambient details (lights, cat). */
  get quiet() {
    return !this.customers.length && !this.particles.length && this.barista.state === 'idle' && !this.barista.path.length;
  }

  /** phase: 'focus' | 'short' | 'long'; status: 'idle' | 'running' | 'paused'. */
  setTimerState(phase, status) {
    if (phase === 'focus' && status === 'running' && !(this.phase === 'focus' && this.status === 'running')) this.spawnIn = 1.5;
    this.phase = phase;
    this.status = status;
  }

  get open() {
    return this.phase === 'focus' && this.status === 'running';
  }

  cupColors() {
    return this.coffee ? this.coffee.cup : ['#fffaf3', '#d8cfc6', '#8a5129'];
  }

  // ------------------------------------------------------------ simulation

  spawn() {
    const c = new Person(randomLook(this.rand));
    [c.x, c.y] = DOOR;
    c.state = 'queue';
    c.target = -1;
    this.customers.push(c);
    this.queue.push(c);
  }

  freeSeat() {
    const free = this.seats.filter((s) => !s.who);
    return free.length ? free[Math.floor(this.rand() * free.length)] : null;
  }

  serve(c) {
    const i = this.queue.indexOf(c);
    if (i >= 0) this.queue.splice(i, 1);
    c.cup = this.cupColors();
    c.state = 'served';
    this.served++;
    this.onServe?.();
    this.burst('heart', c, 1);
    const seat = this.freeSeat();
    if (seat) {
      seat.who = c;
      c.seat = seat;
      c.go(this.custGrid.path(c.x, c.y, ...seat.approach));
    } else {
      c.seat = null;
      c.go(this.custGrid.path(c.x, c.y, ...DOOR));
    }
  }

  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    // the window follows the real sky: morning, day, sunset, night
    this.skyCheck = (this.skyCheck || 0) + dt;
    if (this.skyCheck > 30) {
      this.skyCheck = 0;
      const hour = new Date().getHours();
      if (hour !== this.hour) {
        this.hour = hour;
        this.bg = drawBackground(hour, this.menu).toCanvas();
      }
    }
    if (this.open) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        if (this.queue.length < 3 && this.customers.length < 6) this.spawn();
        const busier = Math.min(0.4, this.menu.length * 0.035);
        this.spawnIn = (8 + this.rand() * 12) * (1 - busier);
      }
    }
    this.updateBarista(dt);
    for (const c of this.customers) this.updateCustomer(c, dt);
    this.customers = this.customers.filter((c) => c.state !== 'gone');
    this.updateCat(dt);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'coin') p.vy += 60 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateCustomer(c, dt) {
    switch (c.state) {
      case 'queue': {
        const idx = this.queue.indexOf(c);
        const [qx, qy] = QUEUE[Math.min(idx, QUEUE.length - 1)];
        if (c.target !== idx) {
          c.target = idx;
          c.go(this.custGrid.path(c.x, c.y, qx, qy));
        }
        if (c.move(dt)) {
          if (idx === 0) {
            c.state = 'order';
            c.timer = 0;
          } else {
            const [px, py] = QUEUE[idx - 1];
            c.face(px - c.x, py - c.y);
          }
        }
        break;
      }
      case 'order':
        c.face(-1, 0);
        c.pose = 'stand';
        c.timer += dt;
        break;
      case 'served':
        if (c.move(dt)) {
          if (!c.seat) {
            c.state = 'gone';
          } else if (!c.onSeat) {
            c.onSeat = true;
            c.go([[c.seat.x, c.seat.y]]);
          } else {
            c.sitOn(c.seat);
            c.state = 'sit';
            c.timer = 22 + this.rand() * 26;
            this.tableCups.push({ seat: c.seat, colors: c.cup, hot: !ICED.has(this.coffee?.id) });
          }
        }
        break;
      case 'sit':
        c.timer -= dt;
        // a break closes the cafe: guests finish up (a paused focus just stops new arrivals)
        if (this.phase !== 'focus' && this.status !== 'idle' && c.timer > 7) c.timer = 2 + this.rand() * 5;
        if (this.rand() < dt * 0.05) this.burst('heart', c, 1);
        if (c.timer <= 0) {
          this.tableCups = this.tableCups.filter((tc) => tc.seat !== c.seat);
          c.standUp();
          c.cup = null;
          const seat = c.seat;
          seat.who = null;
          c.seat = null;
          c.state = 'leave';
          c.go([seat.approach, ...this.custGrid.path(...seat.approach, ...DOOR)]);
        }
        break;
      case 'leave':
        if (c.move(dt)) c.state = 'gone';
        break;
    }
  }

  updateBarista(dt) {
    const b = this.barista;
    const onBreak = this.phase !== 'focus' && this.status !== 'idle';
    switch (b.state) {
      case 'idle': {
        b.pose = 'stand';
        const c = this.queue[0];
        if (c && c.state === 'order') {
          b.order = c;
          b.state = 'toMachine';
          b.go(this.staffGrid.path(b.x, b.y, ...MACHINE));
        } else if (onBreak && !this.queue.length) {
          const seat = this.freeSeat();
          if (seat) {
            seat.who = b;
            b.seat = seat;
            b.onSeat = false;
            b.state = 'toBreak';
            b.go(this.staffGrid.path(b.x, b.y, ...seat.approach));
          }
        } else if (b.x !== REGISTER[0] || b.y !== REGISTER[1]) {
          if (!b.path.length) b.go(this.staffGrid.path(b.x, b.y, ...REGISTER));
          b.move(dt);
        } else b.face(1, 0);
        break;
      }
      case 'toMachine':
        if (b.move(dt)) {
          b.state = 'brewing';
          b.timer = 2.4;
        }
        break;
      case 'brewing':
        b.face(-1, 0);
        b.timer -= dt;
        if (this.rand() < dt * 9) {
          const [sx, sy] = this.screen(3.5, 14 + this.rand() * 4, 22);
          this.particles.push({ type: 'steam', x: sx, y: sy, vx: (this.rand() - 0.5) * 3, vy: -9, life: 1.2, max: 1.2 });
        }
        if (b.timer <= 0) {
          b.cup = this.cupColors();
          b.state = 'toRegister';
          b.go(this.staffGrid.path(b.x, b.y, ...REGISTER));
        }
        break;
      case 'toRegister':
        if (b.move(dt)) {
          b.face(1, 0);
          b.state = 'serving';
          b.timer = 0.45;
        }
        break;
      case 'serving':
        b.timer -= dt;
        if (b.timer <= 0) {
          const c = b.order;
          b.cup = null;
          b.order = null;
          if (c && c.state === 'order') this.serve(c);
          b.state = 'idle';
        }
        break;
      case 'toBreak':
        if (b.move(dt)) {
          if (!b.onSeat) {
            b.onSeat = true;
            b.go([[b.seat.x, b.seat.y]]);
          } else {
            b.sitOn(b.seat);
            b.state = 'onBreak';
            this.tableCups.push({ seat: b.seat, colors: this.cupColors(), hot: !ICED.has(this.coffee?.id) });
          }
        }
        break;
      case 'onBreak':
        if (this.rand() < dt * 0.06) this.burst('note', b, 1);
        if (!onBreak) {
          const seat = b.seat;
          this.tableCups = this.tableCups.filter((tc) => tc.seat !== seat);
          seat.who = null;
          b.seat = null;
          b.standUp();
          b.state = 'returning';
          b.go([seat.approach, ...this.staffGrid.path(...seat.approach, ...REGISTER)]);
        }
        break;
      case 'returning':
        if (b.move(dt)) {
          b.state = 'idle';
          b.face(1, 0);
        }
        break;
    }
  }

  updateCat(dt) {
    this.catT = (this.catT || 0) + dt;
    if (this.catT > 2.6) {
      this.catT = 0;
      if (this.phase === 'focus') {
        const [sx, sy] = this.screen(CAT.x, CAT.y, 10);
        this.particles.push({ type: 'z', x: sx + 3, y: sy - 4, vx: 3, vy: -5, life: 1.8, max: 1.8 });
      }
    }
  }

  /** Screen position (art pixels) of a world point. */
  screen(x, y, z = 0) {
    return [this.roomX + OX + 2 * (x - y), this.roomY + OY + (x + y) - z];
  }

  burst(type, who, n) {
    const d = who.drawable(this.roomX, this.roomY);
    for (let i = 0; i < n; i++) {
      this.particles.push({ type, x: d.head[0] + (this.rand() - 0.5) * 6, y: d.head[1] - 2, vx: (this.rand() - 0.5) * 4, vy: -8, life: 1.6, max: 1.6 });
    }
  }

  /** A completed focus session: coins fly out of the register. */
  celebrate(amount) {
    const [sx, sy] = this.screen(15, 6, 22);
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (this.rand() - 0.5) * 1.8;
      const v = 40 + this.rand() * 40;
      this.particles.push({ type: 'coin', x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.4 + this.rand() * 0.5, max: 1.9 });
    }
    this.particles.push({ type: 'text', text: `+${amount}`, x: sx, y: sy - 10, vx: 0, vy: -10, life: 2.4, max: 2.4 });
    for (const c of this.customers) if (c.state === 'sit') this.burst('heart', c, 2);
  }

  // ------------------------------------------------------------ rendering

  render() {
    const g = this.ctx;
    const { roomX: rx, roomY: ry } = this;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // soft shadow under the floating room
    g.fillStyle = 'rgba(120, 82, 62, 0.10)';
    for (let i = 0; i < 4; i++) {
      const w = 160 - i * 18;
      g.fillRect(Math.round(rx + 118 - w / 2), ry + 186 + i, w, 1);
    }
    g.drawImage(this.bg, rx, ry);
    this.drawSign(g, rx, ry);
    this.drawLights(g, rx, ry);

    const items = this.props.map((p) => ({
      box: p.box,
      rect: { x0: rx + OX + p.dx, y0: ry + OY + p.dy, x1: rx + OX + p.dx + p.raster.w, y1: ry + OY + p.dy + p.raster.h },
      draw: (gg) => gg.drawImage(p.canvas, rx + OX + p.dx, ry + OY + p.dy),
    }));
    items.push(this.barista.drawable(rx, ry));
    for (const c of this.customers) items.push(c.drawable(rx, ry));
    for (const tc of this.tableCups) items.push(this.cupDrawable(tc, rx, ry));
    items.push(this.catDrawable(rx, ry));
    for (const it of depthSort(items)) it.draw(g);

    const front = this.queue[0];
    if (front && front.state === 'order') this.drawBubble(g, front.drawable(rx, ry).head);
    for (const p of this.particles) this.drawParticle(g, p);
  }

  drawSign(g, rx, ry) {
    // a little hanging sign on the door's glass: green while the cafe is open
    const [sx, sy] = this.screen(50.5, 0, 33);
    const x = Math.round(sx) - 3;
    const y = Math.round(sy) - 1;
    g.fillStyle = '#8a7466';
    g.fillRect(x + 1, y - 2, 1, 2);
    g.fillRect(x + 5, y - 2, 1, 2);
    g.fillStyle = OUT;
    g.fillRect(x - 1, y - 1, 9, 5);
    g.fillStyle = this.open ? '#a9d18e' : '#f2a7a0';
    g.fillRect(x, y, 7, 3);
    g.fillStyle = '#fffaf3';
    g.fillRect(x + 1, y + 1, 5, 1);
  }

  drawLights(g, rx, ry) {
    const lit = this.open || this.hour >= 17 || this.hour < 7;
    LIGHTS.forEach((b, i) => {
      const tw = Math.sin(this.t * 1.7 + i * 2.3);
      const x = rx + b.x;
      const y = ry + b.y;
      if (lit && tw > -0.3) {
        g.fillStyle = 'rgba(255, 226, 160, 0.28)';
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
      }
      g.fillStyle = lit && tw > -0.7 ? b.color : '#c9b49f';
      g.fillRect(x, y, 1, 1);
    });
  }

  cupDrawable(tc, rx, ry) {
    const [x, y, z] = tc.seat.cupAt;
    const [sx, sy] = this.screen(x, y, z);
    const px = Math.round(sx) - 1;
    const py = Math.round(sy) - 3;
    const [cup, shade, top] = tc.colors;
    const self = this;
    return {
      box: { x0: x - 0.4, x1: x + 0.4, y0: y - 0.4, y1: y + 0.4, z0: z, z1: z + 4 },
      rect: { x0: px - 1, y0: py - 1, x1: px + 4, y1: py + 5 },
      draw(gg) {
        gg.fillStyle = OUT;
        gg.fillRect(px - 1, py - 1, 4, 5);
        gg.fillStyle = cup;
        gg.fillRect(px, py, 2, 3);
        gg.fillStyle = shade;
        gg.fillRect(px + 1, py + 1, 1, 2);
        gg.fillStyle = top;
        gg.fillRect(px, py, 2, 1);
        if (tc.hot && self.rand() < 0.04) self.particles.push({ type: 'steam', x: px + 1, y: py - 2, vx: 0, vy: -6, life: 1, max: 1 });
      },
    };
  }

  catDrawable(rx, ry) {
    const [sx, sy] = this.screen(CAT.x, CAT.y, 3);
    const awake = this.phase !== 'focus' && this.status !== 'idle';
    let sprite;
    if (awake) sprite = CAT_SPRITES.sit[Math.floor(this.t * 0.8) % 3 === 0 ? 1 : 0];
    else sprite = CAT_SPRITES.sleep[Math.floor(this.t * 1.1) % 2];
    const x = Math.round(sx) - Math.floor(sprite.width / 2);
    const y = Math.round(sy) - sprite.height + 2;
    return {
      box: { x0: CAT.x - 3, x1: CAT.x + 3, y0: CAT.y - 3, y1: CAT.y + 3, z0: 4, z1: 12 },
      rect: { x0: x, y0: y, x1: x + sprite.width, y1: y + sprite.height },
      draw(gg) {
        gg.drawImage(sprite, x, y);
      },
    };
  }

  drawBubble(g, [hx, hy]) {
    const bob = Math.round(Math.sin(this.t * 4) * 0.6);
    const x = hx + 3;
    const y = hy - 15 + bob;
    const [cup, shade, top] = this.cupColors();
    g.fillStyle = OUT;
    g.fillRect(x, y + 1, 13, 9);
    g.fillRect(x + 1, y, 11, 11);
    g.fillRect(x + 2, y + 11, 2, 2);
    g.fillStyle = '#fffaf3';
    g.fillRect(x + 1, y + 1, 11, 9);
    g.fillRect(x + 2, y + 10, 1, 1);
    // tiny cup icon
    g.fillStyle = top;
    g.fillRect(x + 4, y + 3, 4, 1);
    g.fillStyle = cup;
    g.fillRect(x + 4, y + 4, 4, 3);
    g.fillStyle = shade;
    g.fillRect(x + 7, y + 4, 1, 3);
    g.fillRect(x + 8, y + 5, 1, 1);
    g.fillStyle = '#c9b8a8';
    g.fillRect(x + 3, y + 7, 6, 1);
  }

  drawParticle(g, p) {
    const k = p.life / p.max;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (p.type === 'steam') {
      g.fillStyle = `rgba(255, 255, 255, ${0.75 * k})`;
      g.fillRect(x + Math.round(Math.sin(p.life * 6) * 0.8), y, 1, 1);
    } else if (p.type === 'heart') {
      if (k < 0.25 && Math.floor(p.life * 20) % 2) return;
      g.fillStyle = OUT;
      g.fillRect(x - 1, y - 1, 7, 5);
      g.fillRect(x, y + 4, 5, 1);
      g.fillRect(x + 1, y + 5, 3, 1);
      g.fillStyle = '#f08a96';
      g.fillRect(x, y, 2, 1);
      g.fillRect(x + 3, y, 2, 1);
      g.fillRect(x, y + 1, 5, 2);
      g.fillRect(x + 1, y + 3, 3, 1);
      g.fillRect(x + 2, y + 4, 1, 1);
      g.fillStyle = '#ffd3d8';
      g.fillRect(x, y, 1, 1);
    } else if (p.type === 'note') {
      g.fillStyle = OUT;
      g.fillRect(x + 2, y - 4, 1, 5);
      g.fillRect(x, y, 3, 2);
      g.fillRect(x + 3, y - 4, 2, 1);
    } else if (p.type === 'z') {
      g.fillStyle = `rgba(110, 96, 130, ${k})`;
      g.fillRect(x, y, 3, 1);
      g.fillRect(x + 1, y + 1, 1, 1);
      g.fillRect(x, y + 2, 3, 1);
    } else if (p.type === 'coin') {
      g.fillStyle = OUT;
      g.fillRect(x - 1, y - 2, 5, 7);
      g.fillRect(x - 2, y - 1, 7, 5);
      g.fillStyle = '#f5c84c';
      g.fillRect(x - 1, y - 1, 5, 5);
      g.fillStyle = '#fbe39a';
      g.fillRect(x, y - 1, 2, 1);
      g.fillRect(x - 1, y, 1, 2);
      g.fillStyle = '#d89a2b';
      g.fillRect(x + 1, y + 1, 1, 2);
    } else if (p.type === 'text') {
      const w = textWidth(p.text, 2);
      drawText(g, p.text, x - Math.floor(w / 2), y, '#f5c84c', OUT, 2);
    }
  }
}
