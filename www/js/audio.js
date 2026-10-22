// Soft synthesized sounds (no audio files). Browsers only allow audio after a tap,
// so the context is created lazily on the first user gesture.

let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function bell(freq, at, { dur = 1.6, gain = 0.18, type = 'sine' } = {}) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o2.type = 'sine';
  o2.frequency.value = freq * 2.01; // a faint overtone gives it a little shimmer
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o2.connect(g2).connect(g);
  o.connect(g).connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.start(at);
  o2.start(at);
  o.stop(at + dur + 0.05);
  o2.stop(at + dur + 0.05);
}

function ready() {
  if (!enabled || !ctx) return false;
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

/** End of a focus session: a rising three-note chime. */
export function chimeFocusDone() {
  if (!ready()) return;
  const t = ctx.currentTime + 0.02;
  bell(659.25, t);
  bell(830.61, t + 0.18);
  bell(987.77, t + 0.36, { dur: 2.2 });
}

/** End of a break: two gentle notes calling you back. */
export function chimeBreakDone() {
  if (!ready()) return;
  const t = ctx.currentTime + 0.02;
  bell(783.99, t, { dur: 1.2 });
  bell(587.33, t + 0.22, { dur: 1.8 });
}

/** Coins: a quick sparkly arpeggio. */
export function coinSound() {
  if (!ready()) return;
  const t = ctx.currentTime + 0.01;
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, t + i * 0.055, { dur: 0.35, gain: 0.08, type: 'triangle' }));
}

export function tapSound() {
  if (!ready()) return;
  bell(1400, ctx.currentTime + 0.005, { dur: 0.07, gain: 0.035, type: 'triangle' });
}
