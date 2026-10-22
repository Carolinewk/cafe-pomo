// Saved progress and the coin economy. Storage is injected so tests can use a fake.

import { COFFEES, COFFEE_BY_ID, STARTER } from './catalog.js';

export const STORAGE_KEY = 'cafe-pomo:v1';

export const DEFAULT_SETTINGS = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoBreak: true,
  autoFocus: false,
  sound: true,
  keepAwake: true,
};

export const LIMITS = {
  focus: [5, 90, 5],
  short: [1, 30, 1],
  long: [5, 60, 5],
  longEvery: [2, 8, 1],
};

export function defaultState() {
  return {
    coins: 0,
    owned: [STARTER],
    selected: STARTER,
    settings: { ...DEFAULT_SETTINGS },
    stats: { pomodoros: 0, focusMinutes: 0, coinsEarned: 0, served: 0, days: {} },
    timer: null,
    welcomed: false,
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function validTimer(t) {
  if (!isObj(t) || !['focus', 'short', 'long'].includes(t.phase)) return false;
  if (!['idle', 'running', 'paused'].includes(t.status)) return false;
  if (!num(t.remaining) || !Number.isInteger(t.cycle) || t.cycle < 0) return false;
  if (t.status === 'running' && !num(t.endsAt)) return false;
  return t.total === undefined || num(t.total);
}

/** Read saved state, falling back to defaults for anything missing or malformed. */
export function load(storage) {
  const base = defaultState();
  let raw = null;
  try {
    raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
  } catch {
    raw = null;
  }
  if (!isObj(raw)) return base;
  const s = { ...base };
  if (Number.isFinite(raw.coins) && raw.coins >= 0) s.coins = Math.floor(raw.coins);
  if (Array.isArray(raw.owned)) s.owned = [...new Set([STARTER, ...raw.owned.filter((id) => COFFEE_BY_ID[id])])];
  if (COFFEE_BY_ID[raw.selected] && s.owned.includes(raw.selected)) s.selected = raw.selected;
  if (isObj(raw.settings)) {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      const got = raw.settings[k];
      if (typeof v === 'boolean' && typeof got === 'boolean') s.settings[k] = got;
      if (typeof v === 'number' && Number.isFinite(got)) {
        const [lo, hi] = LIMITS[k];
        s.settings[k] = Math.min(hi, Math.max(lo, got));
      }
    }
  }
  if (isObj(raw.stats)) {
    for (const k of ['pomodoros', 'focusMinutes', 'coinsEarned', 'served']) {
      if (Number.isFinite(raw.stats[k]) && raw.stats[k] >= 0) s.stats[k] = raw.stats[k];
    }
    if (isObj(raw.stats.days)) s.stats.days = { ...raw.stats.days };
  }
  if (validTimer(raw.timer)) s.timer = raw.timer;
  s.welcomed = raw.welcomed === true;
  return s;
}

export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Coins paid for one focus session: the drink's rate, scaled to the session length. */
export function rewardFor(coffeeId, focusMinutes) {
  const coffee = COFFEE_BY_ID[coffeeId] || COFFEE_BY_ID[STARTER];
  return Math.max(1, Math.round((coffee.earn * focusMinutes) / 25));
}

export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Credit a finished focus session of `minutes`. Returns the new state and the coins earned. */
export function completeFocus(state, date, minutes = state.settings.focus) {
  const coins = rewardFor(state.selected, minutes);
  const key = dayKey(date);
  const days = { ...state.stats.days, [key]: (state.stats.days[key] || 0) + 1 };
  return {
    state: {
      ...state,
      coins: state.coins + coins,
      stats: {
        ...state.stats,
        pomodoros: state.stats.pomodoros + 1,
        focusMinutes: state.stats.focusMinutes + minutes,
        coinsEarned: state.stats.coinsEarned + coins,
        days,
      },
    },
    coins,
  };
}

export function canBuy(state, id) {
  const coffee = COFFEE_BY_ID[id];
  if (!coffee) return { ok: false, reason: 'unknown' };
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (state.coins < coffee.price) return { ok: false, reason: 'coins', missing: coffee.price - state.coins };
  return { ok: true };
}

export function buy(state, id) {
  const check = canBuy(state, id);
  if (!check.ok) return { state, ...check };
  const coffee = COFFEE_BY_ID[id];
  return { ok: true, state: { ...state, coins: state.coins - coffee.price, owned: [...state.owned, id], selected: id } };
}

export function select(state, id) {
  if (!state.owned.includes(id)) return state;
  return { ...state, selected: id };
}

export function countServed(state, n = 1) {
  return { ...state, stats: { ...state.stats, served: state.stats.served + n } };
}

/** The cheapest drink still to buy, for a gentle "next goal" hint. */
export function nextGoal(state) {
  return COFFEES.filter((c) => !state.owned.includes(c.id)).sort((a, b) => a.price - b.price)[0] || null;
}
