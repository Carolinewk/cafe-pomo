// Settings sheet: durations, behaviour toggles and a few cozy statistics.

import { LIMITS, dayKey } from '../store.js';

const DURATIONS = [
  ['focus', 'Foco', (v) => `${v} min`],
  ['short', 'Pausa curta', (v) => `${v} min`],
  ['long', 'Pausa longa', (v) => `${v} min`],
  ['longEvery', 'Pausa longa a cada', (v) => `${v} focos`],
];

const TOGGLES = [
  ['autoBreak', 'Começar as pausas sozinho', 'Quando um foco termina'],
  ['autoFocus', 'Começar o foco sozinho', 'Quando uma pausa termina'],
  ['sound', 'Sons', 'Sininho ao fim de cada etapa'],
  ['keepAwake', 'Manter a tela acesa', 'Enquanto o timer está correndo'],
];

/** handlers: { onChange(key, value), onResetProgress() } */
export function renderSettings(state, handlers) {
  const durations = document.getElementById('durations');
  durations.replaceChildren(
    ...DURATIONS.map(([key, label, fmt]) => {
      const [lo, hi, step] = LIMITS[key];
      const v = state.settings[key];
      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('span');
      name.textContent = label;
      const stepper = document.createElement('div');
      stepper.className = 'stepper';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `Diminuir ${label}`);
      minus.disabled = v <= lo;
      minus.addEventListener('click', () => handlers.onChange(key, Math.max(lo, v - step)));
      const out = document.createElement('output');
      out.textContent = fmt(v);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', `Aumentar ${label}`);
      plus.disabled = v >= hi;
      plus.addEventListener('click', () => handlers.onChange(key, Math.min(hi, v + step)));
      stepper.append(minus, out, plus);
      row.append(name, stepper);
      return row;
    }),
  );

  const toggles = document.getElementById('toggles');
  toggles.replaceChildren(
    ...TOGGLES.map(([key, label, hint]) => {
      const row = document.createElement('label');
      row.className = 'row';
      const text = document.createElement('span');
      text.textContent = label;
      const small = document.createElement('small');
      small.textContent = hint;
      text.append(small);
      const sw = document.createElement('span');
      sw.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!state.settings[key];
      input.setAttribute('role', 'switch');
      input.addEventListener('change', () => handlers.onChange(key, input.checked));
      sw.append(input, document.createElement('span'));
      row.append(text, sw);
      return row;
    }),
  );

  const s = state.stats;
  const hours = s.focusMinutes / 60;
  const items = [
    [s.days[dayKey(new Date())] || 0, 'pomodoros hoje'],
    [s.pomodoros, 'pomodoros no total'],
    [hours < 10 ? hours.toFixed(1).replace('.', ',') + 'h' : Math.round(hours) + 'h', 'de foco'],
    [s.served, 'cafés servidos'],
  ];
  document.getElementById('stats').replaceChildren(
    ...items.map(([value, label]) => {
      const box = document.createElement('div');
      box.className = 'stat';
      const b = document.createElement('b');
      b.textContent = value;
      const span = document.createElement('span');
      span.textContent = label;
      box.append(b, span);
      return box;
    }),
  );
}
