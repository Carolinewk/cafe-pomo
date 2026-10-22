import test from 'node:test';
import assert from 'node:assert/strict';
import { COFFEES } from '../www/js/catalog.js';
import {
  defaultState,
  load,
  save,
  rewardFor,
  completeFocus,
  buy,
  canBuy,
  select,
  nextGoal,
  STORAGE_KEY,
} from '../www/js/store.js';

function memory(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

test('a new player owns only the espresso, worth 5 coins per pomodoro', () => {
  const s = defaultState();
  assert.equal(s.coins, 0);
  assert.deepEqual(s.owned, ['espresso']);
  assert.equal(s.selected, 'espresso');
  assert.equal(rewardFor('espresso', 25), 5);
});

test('the menu gets pricier and pays more as it goes', () => {
  for (let i = 1; i < COFFEES.length; i++) {
    assert.ok(COFFEES[i].price > COFFEES[i - 1].price, COFFEES[i].id);
    assert.ok(COFFEES[i].earn > COFFEES[i - 1].earn, COFFEES[i].id);
  }
  const ids = COFFEES.map((c) => c.id);
  for (const id of ['doppio', 'macchiato', 'matcha_frappe']) assert.ok(ids.includes(id));
});

test('rewards scale with the focus length and never drop to zero', () => {
  assert.equal(rewardFor('espresso', 50), 10);
  assert.equal(rewardFor('espresso', 5), 1);
  assert.equal(rewardFor('matcha_frappe', 25), 26);
  assert.equal(rewardFor('nope', 25), 5);
});

test('completing focus credits coins and stats for the day', () => {
  const { state, coins } = completeFocus(defaultState(), new Date(2026, 9, 7, 10));
  assert.equal(coins, 5);
  assert.equal(state.coins, 5);
  assert.equal(state.stats.pomodoros, 1);
  assert.equal(state.stats.focusMinutes, 25);
  assert.equal(state.stats.days['2026-10-07'], 1);
});

test('a finished session pays for its planned length, not the current setting', () => {
  const s = { ...defaultState(), settings: { ...defaultState().settings, focus: 50 } };
  assert.equal(completeFocus(s, new Date(), 25).coins, 5);
  assert.equal(completeFocus(s, new Date()).coins, 10);
});

test('three espresso pomodoros buy the double espresso, which is then served', () => {
  let s = defaultState();
  for (let i = 0; i < 2; i++) s = completeFocus(s, new Date()).state;
  assert.deepEqual(canBuy(s, 'doppio'), { ok: false, reason: 'coins', missing: 5 });
  s = completeFocus(s, new Date()).state;
  const r = buy(s, 'doppio');
  assert.equal(r.ok, true);
  assert.equal(r.state.coins, 0);
  assert.equal(r.state.selected, 'doppio');
  assert.deepEqual(r.state.owned, ['espresso', 'doppio']);
  assert.equal(completeFocus(r.state, new Date()).coins, 7);
});

test('cannot buy twice or select what you do not own', () => {
  let s = { ...defaultState(), coins: 1000 };
  s = buy(s, 'latte').state;
  assert.equal(buy(s, 'latte').ok, false);
  assert.equal(buy(s, 'latte').reason, 'owned');
  assert.equal(select(s, 'mocha').selected, 'latte');
  assert.equal(select(s, 'espresso').selected, 'espresso');
});

test('the next goal is the cheapest drink not owned yet', () => {
  assert.equal(nextGoal(defaultState()).id, 'doppio');
  const all = { ...defaultState(), owned: COFFEES.map((c) => c.id) };
  assert.equal(nextGoal(all), null);
});

test('save and load round-trip', () => {
  const mem = memory();
  let s = { ...defaultState(), coins: 42, owned: ['espresso', 'mocha'], selected: 'mocha' };
  s.settings.focus = 50;
  assert.equal(save(mem, s), true);
  const back = load(mem);
  assert.equal(back.coins, 42);
  assert.equal(back.selected, 'mocha');
  assert.equal(back.settings.focus, 50);
});

test('loading repairs junk instead of crashing', () => {
  assert.deepEqual(load(memory({ [STORAGE_KEY]: '{not json' })), defaultState());
  const weird = load(
    memory({
      [STORAGE_KEY]: JSON.stringify({
        coins: -3,
        owned: ['latte', 'ghost'],
        selected: 'ghost',
        settings: { focus: 999, short: 'x', sound: false },
        stats: { pomodoros: 3 },
      }),
    }),
  );
  assert.equal(weird.coins, 0);
  assert.deepEqual(weird.owned, ['espresso', 'latte']);
  assert.equal(weird.selected, 'espresso');
  assert.equal(weird.settings.focus, 90);
  assert.equal(weird.settings.short, 5);
  assert.equal(weird.settings.sound, false);
  assert.equal(weird.stats.pomodoros, 3);
});

test('a saved timer comes back only when it is well-formed', () => {
  const good = { phase: 'short', status: 'running', endsAt: 123, remaining: 300000, total: 300000, cycle: 2 };
  assert.deepEqual(load(memory({ [STORAGE_KEY]: JSON.stringify({ timer: good }) })).timer, good);
  for (const bad of [
    { ...good, status: 'running', endsAt: null },
    { ...good, phase: 'nap' },
    { ...good, remaining: 'soon' },
    { ...good, cycle: -1 },
  ]) {
    assert.equal(load(memory({ [STORAGE_KEY]: JSON.stringify({ timer: bad }) })).timer, null);
  }
});

test('saving survives a full or blocked storage', () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(save(broken, defaultState()), false);
});
