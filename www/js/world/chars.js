// Chibi pixel characters, composed from hand-drawn text layers and palette swaps.
// Frame: 14 x 27 fill pixels (rows 0-2 leave room for buns and hats), outlined to 16 x 29.

import { Raster, textSprite, darken, lighten } from './pixel.js';
import { OUT } from './room.js';

// ---------------------------------------------------------------- layers

const BODY_FRONT = [
  '..............',
  '..............',
  '..............',
  '....ssssss....',
  '..ssssssssss..',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.sssssessesss.',
  '.sssssessesss.',
  '.ssssbssssbss.',
  '..ssssssssss..',
  '....ssssss....',
  '......ss......',
  '...tttttttT...',
  '..ttttttttTT..',
  '..ttttttttTT..',
  '..tTttttttTT..',
  '..tTttttttTT..',
  '..tTttttttTT..',
  '..spppppppPS..',
];

const BODY_BACK = [
  '..............',
  '..............',
  '..............',
  '....ssssss....',
  '..ssssssssss..',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '.ssssssssssss.',
  '..ssssssssss..',
  '....ssssss....',
  '......SS......',
  '...Tttttttt...',
  '..TTtttttttt..',
  '..TTtttttttt..',
  '..TTttttttTt..',
  '..TTttttttTt..',
  '..TTttttttTt..',
  '..SPppppppps..',
];

// rows 22-26: legs. Index 0 = standing, 1 and 2 = walking steps.
const LEGS = [
  ['...pppppppP...', '...ppp..pPP...', '...ppp..pPP...', '...fff..fff...', '..............'],
  ['...pppppppP...', '...ppp..pPP...', '...ppp...fff..', '...fff........', '..............'],
  ['...pppppppP...', '...ppp..pPP...', '..fff...pPP...', '........fff...', '..............'],
];
const LEGS_SIT = ['...pppppppP...', '..ppppppppPP..', '..ff......ff..', '..............', '..............'];

const APRON_FRONT = [
  '...a......a...',
  '....aaaaaa....',
  '....aaaaaa....',
  '....aaAaaa....',
  '...aaaaaaaA...',
  '...aaaaaaaA...',
  '...aaaaaaaA...',
  '...aaaaaaaA...',
];
const APRON_BACK = ['...a......a...', '..............', '..............', '..............', '....aAAAAa....', '..............', '..............', '..............'];

// Hair overlays: [front, back]. '.' keeps whatever is below.
const HAIR = {
  bob: [
    [
      '..............',
      '..............',
      '..............',
      '....hhhhhh....',
      '..hhllhhhhhh..',
      '.hhlhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhHhhHhh.',
      '.hhh..h.....h.',
      '.hh.........h.',
      '.hh...........',
      '.hh...........',
      '.hh...........',
    ],
    [
      '..............',
      '..............',
      '..............',
      '....hhhhhh....',
      '..hhhhhhllhh..',
      '.hhhhhhhhhlhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hHhhhhhhhhHh.',
      '.hHHhhhhhhHHh.',
      '..............',
    ],
  ],
  short: [
    [
      '..............',
      '..............',
      '..............',
      '....hhhhhh....',
      '..hhhlhhhhhh..',
      '.hhhlhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhHhHhhh.',
      '.hhh.h.....hh.',
      '.hh...........',
      '.h............',
    ],
    [
      '..............',
      '..............',
      '..............',
      '....hhhhhh....',
      '..hhhhhhlhhh..',
      '.hhhhhhhhlhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hHhhhhhhhhHh.',
      '..HHhhhhhhHH..',
    ],
  ],
  long: [
    [
      '..............',
      '..............',
      '..............',
      '....hhhhhh....',
      '..hhllhhhhhh..',
      '.hhlhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhHhhhHhh.',
      'hhhh..h.....hh',
      'hhh.........hh',
      'hhh..........h',
      'hhh..........h',
      'hhhh.........h',
      'hhh..........h',
      '.hh..........h',
      '.hh...........',
      '.h............',
    ],
    [
      '..............',
      '..............',
      '..............',
      '....hhhhhh....',
      '..hhhhhhllhh..',
      '.hhhhhhhhhlhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      'hhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhh',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '..hHhhhhhhHh..',
      '...HhhhhhhH...',
    ],
  ],
  bun: [
    [
      '....hhhh......',
      '...hhllhh.....',
      '....cccc......',
      '....hhhhhh....',
      '..hhllhhhhhh..',
      '.hhlhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhHhhHhh.',
      '.hhh..h.....h.',
      '.hh.........h.',
      '.h............',
    ],
    [
      '......hhhh....',
      '.....hhhllh...',
      '......cccc....',
      '....hhhhhh....',
      '..hhhhhhllhh..',
      '.hhhhhhhhhlhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hHhhhhhhhhHh.',
      '..HHhhhhhhHH..',
    ],
  ],
  twin: [
    [
      '..............',
      '..............',
      'hhh........hhh',
      'hlhhhhhhhhhhlh',
      'hhhhllhhhhhhhh',
      '.hhlhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhHhhHhh.',
      '.hhh..h.....h.',
      '.hh.........h.',
      '.h............',
    ],
    [
      '..............',
      '..............',
      'hhh........hhh',
      'hlhhhhhhhhhhlh',
      'hhhhhhhhllhhhh',
      '.hhhhhhhhhlhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hHhhhhhhhhHh.',
      '..HHhhhhhhHH..',
    ],
  ],
  beanie: [
    [
      '..............',
      '.....cccc.....',
      '....cccccc....',
      '...cCcCcCcc...',
      '..cCcCcCcCcc..',
      '.cCcCcCcCcCcc.',
      '.kkkkkkkkkkkk.',
      '.hhhhhhhhhhhh.',
      '.hhhh.h.h.hhh.',
      '.hh.........h.',
      '.hh.........h.',
      '.h............',
    ],
    [
      '..............',
      '.....cccc.....',
      '....cccccc....',
      '...cCcCcCcc...',
      '..cCcCcCcCcc..',
      '.cCcCcCcCcCcc.',
      '.kkkkkkkkkkkk.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hhhhhhhhhhhh.',
      '.hHhhhhhhhhHh.',
      '..HHhhhhhhHH..',
    ],
  ],
};

export const HAIR_STYLES = Object.keys(HAIR);

const pad = (rows, n = 27) => rows.concat(Array(Math.max(0, n - rows.length)).fill('..............'));

/** Overlay text layers: later layers win where they are not transparent. */
function stack(...layers) {
  const out = [];
  for (let y = 0; y < 27; y++) {
    let row = '';
    for (let x = 0; x < 14; x++) {
      let ch = '.';
      for (const l of layers) {
        const c = l[y]?.[x];
        if (c && c !== '.') ch = c;
      }
      row += ch;
    }
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------- palettes

export const SKINS = ['#f8dcc8', '#efc3a3', '#d9a07c', '#b07650', '#8a5638'];
export const HAIRS = ['#4a3330', '#6e4a3a', '#a8714c', '#e2b878', '#2f2e3a', '#c46a5a', '#e7a6b5', '#8a8fa8'];
export const TOPS = ['#e8a0a0', '#a3b9e6', '#f2d58a', '#9fcaa8', '#c9a6e0', '#f4efe6', '#f2b48c', '#8fc1c9'];
export const BOTTOMS = ['#5b6478', '#6b5446', '#3f3a44', '#7d8a9e', '#a58f7a'];

export function palette({ skin, hair, top, bottom, apron = '#7f9c74', cap = '#e39b8f', shoes = '#5a4642' }) {
  return {
    s: skin,
    S: darken(skin, 0.18),
    e: '#3b2b2a',
    b: '#f0a39c',
    h: hair,
    H: darken(hair, 0.22),
    l: lighten(hair, 0.28),
    t: top,
    T: darken(top, 0.16),
    p: bottom,
    P: darken(bottom, 0.18),
    f: shoes,
    a: apron,
    A: darken(apron, 0.15),
    c: cap,
    C: darken(cap, 0.14),
    k: lighten(cap, 0.3),
    u: '#fffaf3',
    U: '#d8cfc6',
  };
}

// ---------------------------------------------------------------- composer

const cupLayer = (dir) => {
  // a small cup held at the right hand (front) or left hand (back)
  const rows = Array(27).fill('..............');
  if (dir === 'front') {
    rows[18] = '...........qq.';
    rows[19] = '...........uU.';
    rows[20] = '...........uU.';
  } else {
    rows[18] = '..qq..........';
    rows[19] = '..uU..........';
  }
  return rows;
};

const spriteCache = new Map();

/**
 * Build (and cache) a character frame.
 * look: { skin, hair, top, bottom, style, apron?, cap? }
 * pose: 'stand' | 'walk1' | 'walk2' | 'sit'; dir: 'front' | 'back'; cup: color pair or null.
 */
export function frame(look, dir, pose, cup = null) {
  const key = JSON.stringify([look, dir, pose, cup]);
  let r = spriteCache.get(key);
  if (r) return r;
  const front = dir === 'front';
  const body = front ? BODY_FRONT : BODY_BACK;
  const legs = pose === 'sit' ? LEGS_SIT : LEGS[pose === 'walk1' ? 1 : pose === 'walk2' ? 2 : 0];
  const hair = HAIR[look.style] || HAIR.bob;
  const layers = [pad(body.concat(legs)), pad(hair[front ? 0 : 1])];
  if (look.apron) layers.splice(1, 0, pad(Array(15).fill('..............').concat(front ? APRON_FRONT : APRON_BACK)));
  if (cup) layers.push(cupLayer(dir));
  const rows = stack(...layers);
  const pal = palette(look);
  if (cup) {
    pal.u = cup[0];
    pal.U = cup[1];
    pal.q = cup[2] || cup[1];
  }
  const core = textSprite(rows, pal);
  r = new Raster(core.w + 2, core.h + 2);
  r.blit(core, 1, 1);
  r.outline(OUT);
  spriteCache.set(key, r);
  return r;
}

/** Anchor (feet centre) inside an outlined frame. */
export const ANCHOR = { x: 8, y: 27 };

const rand = (list, rnd) => list[Math.floor(rnd() * list.length)];

export function randomLook(rnd) {
  const style = rand(['bob', 'short', 'long', 'bun', 'twin', 'beanie', 'short', 'long'], rnd);
  return {
    skin: rand(SKINS, rnd),
    hair: rand(HAIRS, rnd),
    top: rand(TOPS, rnd),
    bottom: rand(BOTTOMS, rnd),
    style,
    cap: rand(['#e39b8f', '#9fb6d1', '#f2d27a', '#a9c09e', '#c9a6e0'], rnd),
  };
}

export const BARISTA = { skin: '#f3cfb4', hair: '#6e4a3a', top: '#fbf5ec', bottom: '#4f4a52', style: 'bun', apron: '#7f9c74' };
