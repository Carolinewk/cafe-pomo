import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimer,
  start,
  pause,
  reset,
  skip,
  tick,
  remainingMs,
  progress,
  durationOf,
  formatClock,
  hasProgress,
  switchTo,
} from '../www/js/timer.js';


const S = { focus: 25, short: 5, long: 15, longEvery: 4, autoBreak: false, autoFocus: false };
const MIN = 60000;

test('a new timer waits on a full focus session', () => {
  const t = createTimer(S);
  assert.equal(t.phase, 'focus');
  assert.equal(t.status, 'idle');
  assert.equal(remainingMs(t, 0), 25 * MIN);
  assert.equal(progress(t, S, 0), 0);
});

test('start, pause and resume keep the remaining time exact', () => {
  let t = start(createTimer(S), 1000);
  assert.equal(t.endsAt, 1000 + 25 * MIN);
  t = pause(t, 1000 + 10 * MIN);
  assert.equal(t.status, 'paused');
  assert.equal(t.remaining, 15 * MIN);
  t = start(t, 5_000_000);
  assert.equal(remainingMs(t, 5_000_000 + MIN), 14 * MIN);
});

test('starting twice does not move the deadline', () => {
  const a = start(createTimer(S), 0);
  const b = start(a, 60_000);
  assert.equal(b.endsAt, a.endsAt);
});

test('finishing a focus session emits one completion and moves to a short break', () => {
  const t = start(createTimer(S), 0);
  const { state, events } = tick(t, S, 25 * MIN);
  assert.deepEqual(events, [{ type: 'complete', phase: 'focus', at: 25 * MIN, minutes: 25 }]);
  assert.equal(state.phase, 'short');
  assert.equal(state.status, 'idle');
  assert.equal(state.cycle, 1);
});

test('nothing happens before the deadline', () => {
  const t = start(createTimer(S), 0);
  const { state, events } = tick(t, S, 25 * MIN - 1);
  assert.equal(events.length, 0);
  assert.equal(state, t);
});

test('every fourth focus session earns a long break, which resets the cycle', () => {
  let t = { ...createTimer(S), cycle: 3 };
  t = start(t, 0);
  let r = tick(t, S, 25 * MIN);
  assert.equal(r.state.phase, 'long');
  assert.equal(r.state.cycle, 4);
  t = start(r.state, 0);
  r = tick(t, S, 15 * MIN);
  assert.equal(r.state.phase, 'focus');
  assert.equal(r.state.cycle, 0);
});

test('auto-start chains phases from the exact end time while the app was closed', () => {
  const auto = { ...S, autoBreak: true, autoFocus: true };
  const t = start(createTimer(auto), 0);
  // 25 focus + 5 break + 25 focus + 5 break = 60 minutes, then 2 minutes into focus
  const { state, events } = tick(t, auto, 62 * MIN);
  assert.deepEqual(
    events.map((e) => [e.phase, e.at / MIN]),
    [
      ['focus', 25],
      ['short', 30],
      ['focus', 55],
      ['short', 60],
    ],
  );
  assert.equal(state.phase, 'focus');
  assert.equal(state.status, 'running');
  assert.equal(remainingMs(state, 62 * MIN), 23 * MIN);
});

test('auto-break only: the break runs, the next focus waits for the user', () => {
  const s = { ...S, autoBreak: true };
  const { state, events } = tick(start(createTimer(s), 0), s, 40 * MIN);
  assert.equal(events.length, 2);
  assert.equal(state.phase, 'focus');
  assert.equal(state.status, 'idle');
});

test('skipping a focus session does not count it', () => {
  const t = start(createTimer(S), 0);
  const s = skip(t, S);
  assert.equal(s.phase, 'short');
  assert.equal(s.cycle, 0);
  assert.equal(s.status, 'idle');
  assert.equal(skip(s, S).phase, 'focus');
});

test('skipping a long break starts a fresh set', () => {
  const t = switchTo({ ...createTimer(S), cycle: 4 }, 'long', S);
  assert.equal(skip(t, S).cycle, 0);
});

test('reset restores the full phase length', () => {
  const t = pause(start(createTimer(S), 0), 10 * MIN);
  const r = reset(t, S);
  assert.equal(r.status, 'idle');
  assert.equal(r.remaining, 25 * MIN);
});

test('progress only counts once real time was spent', () => {
  const t = start(createTimer(S), 0);
  assert.equal(hasProgress(t, S, 10_000), false);
  assert.equal(hasProgress(t, S, 2 * MIN), true);
  assert.equal(hasProgress(createTimer(S), S, 0), false);
});

test('changing the settings mid-session keeps the planned length and reward', () => {
  const t = start(createTimer(S), 0);
  const longer = { ...S, focus: 50 };
  assert.equal(progress(t, longer, 12.5 * MIN), 0.5);
  const { events } = tick(t, longer, 25 * MIN);
  assert.equal(events[0].minutes, 25);
  assert.equal(reset(t, longer).total, 50 * MIN);
});

test('speed divides durations for quick testing', () => {
  assert.equal(durationOf('focus', { ...S, speed: 60 }), 25_000);
});

test('clock formatting rounds up to whole seconds', () => {
  assert.equal(formatClock(25 * MIN), '25:00');
  assert.equal(formatClock(61_001), '01:02');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(999), '00:01');
});
