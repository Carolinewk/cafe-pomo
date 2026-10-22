// Pomodoro state machine. Pure functions over a plain object so it can be saved,
// restored after the app was closed, and tested without a browser.
//
// state = { phase, status, endsAt, remaining, total, cycle }
//   phase:   'focus' | 'short' | 'long'
//   status:  'idle' | 'running' | 'paused'
//   endsAt:  epoch ms when the running phase ends (null otherwise)
//   remaining: ms left while idle or paused
//   total:   planned length of this phase in ms (settings changed mid-phase don't affect it)
//   cycle:   focus sessions finished since the last long break

export const PHASES = ['focus', 'short', 'long'];

export function durationOf(phase, settings) {
  const minutes = phase === 'focus' ? settings.focus : phase === 'short' ? settings.short : settings.long;
  return Math.round(minutes * 60000 / (settings.speed || 1));
}

export function createTimer(settings, phase = 'focus') {
  const total = durationOf(phase, settings);
  return { phase, status: 'idle', endsAt: null, remaining: total, total, cycle: 0 };
}

export function remainingMs(state, now) {
  if (state.status === 'running') return Math.max(0, state.endsAt - now);
  return state.remaining;
}

const totalOf = (state, settings) => state.total || durationOf(state.phase, settings);

/** 0 at the start of a phase, 1 when it is over. */
export function progress(state, settings, now) {
  const total = totalOf(state, settings);
  return total > 0 ? Math.min(1, Math.max(0, 1 - remainingMs(state, now) / total)) : 1;
}

/** Planned minutes of the current phase (what a finished focus session pays for). */
export function plannedMinutes(state, settings) {
  return Math.round((totalOf(state, settings) * (settings.speed || 1)) / 60000);
}

export function start(state, now) {
  if (state.status === 'running') return state;
  return { ...state, status: 'running', endsAt: now + state.remaining, remaining: state.remaining };
}

export function pause(state, now) {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', remaining: Math.max(0, state.endsAt - now), endsAt: null };
}

export function reset(state, settings) {
  const total = durationOf(state.phase, settings);
  return { ...state, status: 'idle', endsAt: null, remaining: total, total };
}

/** Jump to a phase without completing the current one (nothing is rewarded). */
export function switchTo(state, phase, settings) {
  const cycle = phase === 'focus' && state.phase === 'long' ? 0 : state.cycle;
  const total = durationOf(phase, settings);
  return { ...state, phase, cycle, status: 'idle', endsAt: null, remaining: total, total };
}

/** The phase that follows the current one when it completes. */
export function nextPhase(state, settings) {
  if (state.phase !== 'focus') return 'focus';
  return (state.cycle + 1) % settings.longEvery === 0 ? 'long' : 'short';
}

/** Skip the current phase: a skipped focus does not count towards the long break. */
export function skip(state, settings) {
  if (state.phase === 'focus') {
    const phase = (state.cycle + 1) % settings.longEvery === 0 ? 'long' : 'short';
    return switchTo(state, phase, settings);
  }
  return switchTo(state, 'focus', settings);
}

/** Has the user put real time into this phase? (used to confirm before throwing it away) */
export function hasProgress(state, settings, now) {
  return state.status !== 'idle' && totalOf(state, settings) - remainingMs(state, now) > 30000 / (settings.speed || 1);
}

/**
 * Advance time. Every phase that ended before `now` completes in order, so a timer left
 * running while the app was closed catches up. Returns the new state and the events.
 */
export function tick(state, settings, now) {
  const events = [];
  let s = state;
  let guard = 0;
  while (s.status === 'running' && s.endsAt <= now && guard++ < 50) {
    const endedAt = s.endsAt;
    events.push({ type: 'complete', phase: s.phase, at: endedAt, minutes: plannedMinutes(s, settings) });
    let cycle = s.cycle;
    let next;
    if (s.phase === 'focus') {
      cycle += 1;
      next = cycle % settings.longEvery === 0 ? 'long' : 'short';
    } else {
      next = 'focus';
      if (s.phase === 'long') cycle = 0;
    }
    const auto = next === 'focus' ? settings.autoFocus : settings.autoBreak;
    const total = durationOf(next, settings);
    s = auto
      ? { phase: next, status: 'running', endsAt: endedAt + total, remaining: total, total, cycle }
      : { phase: next, status: 'idle', endsAt: null, remaining: total, total, cycle };
  }
  return { state: s, events };
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
