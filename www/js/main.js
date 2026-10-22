// Café Pomo: wires the timer, the economy, the pixel cafe and the pencil illustrations.

import { COFFEES, COFFEE_BY_ID } from './catalog.js';
import * as T from './timer.js';
import * as Store from './store.js';
import { Cafe } from './world/scene.js';
import { Ring } from './ui/ring.js';
import { renderCoffee } from './art/coffees.js';
import { textSprite } from './world/pixel.js';
import { renderShop } from './ui/shop.js';
import { renderSettings } from './ui/settings.js';
import { dialog, initDialog, banner, openSheet, closeSheet, initSheets } from './ui/dialog.js';
import { unlockAudio, setSoundEnabled, chimeFocusDone, chimeBreakDone, coinSound, tapSound } from './audio.js';
import { mulberry32 } from './art/rng.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const params = new URLSearchParams(location.search);
const speed = Math.max(1, Number(params.get('speed')) || 1);

const PHASE_NAMES = { focus: 'Foco', short: 'Pausa', long: 'Pausa longa' };

// ---------------------------------------------------------------- state

const storage = (() => {
  try {
    const s = window.localStorage;
    s.getItem('probe');
    return s;
  } catch {
    const mem = {};
    return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)) };
  }
})();

let state = Store.load(storage);
const settings = () => ({ ...state.settings, speed });
// With ?speed (testing), saved durations would not match, so keep only the phase and cycle.
let timer = !state.timer
  ? T.createTimer(settings())
  : speed === 1
    ? state.timer
    : { ...T.switchTo(T.createTimer(settings()), state.timer.phase, settings()), cycle: state.timer.cycle || 0 };
let saveTimer = 0;

function persist() {
  state = { ...state, timer };
  Store.save(storage, state);
}

function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
}

// ---------------------------------------------------------------- generated art for the page

function makeCoinIcon() {
  const coin = textSprite(
    [
      '...oooo...',
      '.ooyyyyoo.',
      '.oyYYyyyo.',
      'oyYyyyyydo',
      'oyYyyyyydo',
      'oyyyyyyydo',
      'oyyyyyyddo',
      '.oyyyyddo.',
      '.ooddddoo.',
      '...oooo...',
    ],
    { o: '#8a5a1e', y: '#f5c84c', Y: '#fde9a6', d: '#d9982b' },
  ).toCanvas();
  app.style.setProperty('--coin-url', `url(${coin.toDataURL()})`);
}

function makePaperGrain() {
  const size = 220;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rand = mulberry32(7);
  for (let i = 0; i < size * size; i++) {
    const r = rand();
    img.data[i * 4] = 120;
    img.data[i * 4 + 1] = 86;
    img.data[i * 4 + 2] = 62;
    img.data[i * 4 + 3] = r > 0.985 ? 26 : r > 0.9 ? 10 : r * 7;
  }
  g.putImageData(img, 0, 0);
  const url = `url(${c.toDataURL()})`;
  document.documentElement.style.setProperty('--grain-url', url);
}

// ---------------------------------------------------------------- the cafe and the ring

const cafe = new Cafe($('world'));
const ring = new Ring($('ring'));
cafe.onServe = () => {
  state = Store.countServed(state);
  persistSoon();
};

function currentCoffee() {
  return COFFEE_BY_ID[state.selected] || COFFEE_BY_ID.espresso;
}

let coffeeShown = null;
function showCoffee(animate = false) {
  const coffee = currentCoffee();
  const holder = $('coffee');
  const canvas = $('coffee-art');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = Math.round(holder.offsetWidth * dpr);
  if (!px) return;
  const key = `${coffee.id}@${px}`;
  if (key !== coffeeShown) {
    coffeeShown = key;
    canvas.width = px;
    canvas.height = px;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, px, px);
    g.drawImage(renderCoffee(coffee.id, px), 0, 0);
    if (animate) {
      holder.classList.remove('swap');
      void holder.offsetWidth;
      holder.classList.add('swap');
    }
  }
  $('coffee-name').textContent = coffee.name;
  const minutes = timer.phase === 'focus' ? T.plannedMinutes(timer, settings()) : state.settings.focus;
  $('coffee-earn').textContent = Store.rewardFor(coffee.id, minutes);
  holder.setAttribute('aria-label', `${coffee.name}: trocar o café servido`);
  cafe.setCoffee(coffee);
  cafe.setMenu(COFFEES.filter((c) => state.owned.includes(c.id)));
}

function layout() {
  if (window.matchMedia('(min-width: 600px) and (min-height: 480px)').matches) {
    const fit = Math.min(1, (window.innerHeight - 36) / 956, (window.innerWidth - 36) / 440);
    app.style.setProperty('--fit', fit.toFixed(4));
  }
  ring.resize($('ring-wrap').offsetWidth);
  showCoffee();
  const slot = $('cafe-slot');
  const w = app.offsetWidth;
  const h = app.offsetHeight;
  // the visible room spans art rows 4..188 (wall caps to the floor's shadow)
  const px = Math.min(w / 220, slot.offsetHeight / 184);
  const roomTop = slot.offsetTop + Math.max(0, (slot.offsetHeight - 184 * px) / 2) - 4 * px;
  cafe.layout(w, h, roomTop, px);
  drawRing(true);
}

// ---------------------------------------------------------------- timer ui

let lastClock = '';
let lastProgress = -1;

function drawRing(force = false) {
  const p = T.progress(timer, settings(), Date.now());
  if (!force && Math.abs(p - lastProgress) < 0.0004) return;
  lastProgress = p;
  ring.draw(timer.phase, p);
}

function renderTimer() {
  const now = Date.now();
  const clock = T.formatClock(T.remainingMs(timer, now));
  if (clock !== lastClock) {
    lastClock = clock;
    $('time').textContent = clock;
    document.title = timer.status === 'running' ? `${clock} · ${PHASE_NAMES[timer.phase]} — Café Pomo` : 'Café Pomo';
  }
  drawRing();
}

function renderStatic() {
  app.classList.remove('phase-focus', 'phase-short', 'phase-long', 'status-idle', 'status-running', 'status-paused');
  app.classList.add(`phase-${timer.phase}`, `status-${timer.status}`);
  $('phase-name').textContent = PHASE_NAMES[timer.phase];
  const every = state.settings.longEvery;
  const done = timer.phase === 'long' ? every : timer.cycle % every;
  $('dots').replaceChildren(
    ...Array.from({ length: every }, (_, i) => {
      const dot = document.createElement('i');
      if (i < done) dot.className = 'on';
      return dot;
    }),
  );
  const label = timer.status === 'running' ? 'Pausar' : timer.status === 'paused' ? 'Continuar' : 'Começar';
  $('toggle').setAttribute('aria-label', label);
  showCoins(state.coins);
  cafe.setTimerState(timer.phase, timer.status);
  lastClock = '';
  renderTimer();
  drawRing(true);
  syncWakeLock();
}

function commit() {
  persist();
  renderStatic();
}

// ---------------------------------------------------------------- actions

async function toggle() {
  unlockAudio();
  tapSound();
  const now = Date.now();
  timer = timer.status === 'running' ? T.pause(timer, now) : T.start(timer, now);
  commit();
}

async function confirmThrowAway(kind) {
  if (timer.phase !== 'focus' || !T.hasProgress(timer, settings(), Date.now())) return true;
  return dialog({
    title: kind === 'reset' ? 'Recomeçar o foco?' : 'Pular este foco?',
    text: 'Os clientes vão embora sem o café e este pomodoro não rende moedas.',
    ok: kind === 'reset' ? 'Recomeçar' : 'Pular',
    cancel: 'Continuar',
    danger: true,
  });
}

async function resetTimer() {
  unlockAudio();
  if (!(await confirmThrowAway('reset'))) return;
  timer = T.reset(timer, settings());
  commit();
}

async function skipPhase() {
  unlockAudio();
  if (!(await confirmThrowAway('skip'))) return;
  timer = T.skip(timer, settings());
  commit();
}

function handleEvents(events) {
  let coins = 0;
  let focusDone = 0;
  let breakDone = false;
  for (const ev of events) {
    if (ev.phase === 'focus') {
      const r = Store.completeFocus(state, new Date(ev.at), ev.minutes);
      state = r.state;
      coins += r.coins;
      focusDone++;
    } else breakDone = true;
  }
  if (focusDone) {
    cafe.celebrate(coins);
    chimeFocusDone();
    setTimeout(coinSound, 650);
    bumpCoins();
    const sub = document.createElement('span');
    const icon = document.createElement('span');
    icon.className = 'coin-icon';
    sub.append(`+${coins}`, icon, timer.phase !== 'focus' && timer.status === 'running' ? ' · a pausa já começou' : ' · hora da pausa');
    banner(focusDone > 1 ? `${focusDone} pomodoros concluídos!` : 'Pomodoro concluído!', '', {
      icon: renderCoffee(currentCoffee().id, 120, { backdrop: false }),
      subHtml: [sub],
    });
  } else if (breakDone) {
    chimeBreakDone();
    banner('Fim da pausa', timer.status === 'running' ? 'O próximo foco já começou' : 'Bora abrir o café de novo?', {
      icon: renderCoffee(currentCoffee().id, 120, { backdrop: false }),
    });
  }
}

// the coin counters tick towards their new value
let coinsShown = null;
let coinAnim = 0;
function showCoins(value) {
  const set = (v) => {
    $('coin-count').textContent = v;
    $('shop-coins').textContent = v;
  };
  if (coinsShown === null || coinsShown === value) {
    coinsShown = value;
    set(value);
    return;
  }
  const from = coinsShown;
  const t0 = performance.now();
  const dur = Math.min(900, 250 + Math.abs(value - from) * 8);
  cancelAnimationFrame(coinAnim);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const eased = 1 - (1 - k) ** 3;
    coinsShown = Math.round(from + (value - from) * eased);
    set(coinsShown);
    if (k < 1) coinAnim = requestAnimationFrame(step);
  };
  coinAnim = requestAnimationFrame(step);
}

function renderGoal() {
  const goal = Store.nextGoal(state);
  const text = $('goal-text');
  const fill = $('goal-fill');
  if (!goal) {
    text.textContent = 'Você desbloqueou o cardápio inteiro. Que cafeteria!';
    fill.style.width = '100%';
    return;
  }
  const missing = goal.price - state.coins;
  const perPomo = Store.rewardFor(state.selected, state.settings.focus);
  text.textContent =
    missing > 0
      ? `Próxima receita: ${goal.name}. Faltam ${missing} moedas, cerca de ${Math.ceil(missing / perPomo)} ${Math.ceil(missing / perPomo) === 1 ? 'pomodoro' : 'pomodoros'}.`
      : `Você já pode comprar ${goal.name}!`;
  fill.style.width = `${Math.min(100, (state.coins / goal.price) * 100)}%`;
}

function bumpCoins() {
  const el = $('coins');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function tickTimer() {
  const { state: next, events } = T.tick(timer, settings(), Date.now());
  if (events.length) {
    timer = next;
    handleEvents(events);
    commit();
    refreshShopIfOpen();
  }
}

// ---------------------------------------------------------------- shop & settings

const shopHandlers = {
  onBuy(id) {
    const r = Store.buy(state, id);
    if (!r.ok) return;
    state = r.state;
    coinSound();
    persist();
    renderStatic();
    renderShop($('menu-grid'), state, shopHandlers, id);
    renderGoal();
    showCoffee(true);
    banner('Receita nova!', `Agora o café serve ${COFFEE_BY_ID[id].name}`, { icon: renderCoffee(id, 120, { backdrop: false }) });
  },
  onSelect(id) {
    tapSound();
    state = Store.select(state, id);
    persist();
    renderShop($('menu-grid'), state, shopHandlers);
    showCoffee(true);
    closeSheet('shop');
  },
};

function openShop() {
  unlockAudio();
  tapSound();
  renderShop($('menu-grid'), state, shopHandlers);
  renderGoal();
  openSheet('shop');
}

function refreshShopIfOpen() {
  if ($('shop').hidden) return;
  renderShop($('menu-grid'), state, shopHandlers);
  renderGoal();
}

const settingsHandlers = {
  onChange(key, value) {
    state = { ...state, settings: { ...state.settings, [key]: value } };
    if (key === 'sound') setSoundEnabled(value);
    if (['focus', 'short', 'long'].includes(key) && timer.status === 'idle') timer = T.reset(timer, settings());
    persist();
    renderSettings(state, settingsHandlers);
    renderStatic();
    showCoffee();
  },
  async onResetProgress() {
    const ok = await dialog({
      title: 'Apagar tudo?',
      text: 'Suas moedas, cafés desbloqueados e estatísticas voltam do zero. Os ajustes continuam.',
      ok: 'Apagar',
      cancel: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    state = { ...Store.defaultState(), settings: state.settings, welcomed: true };
    timer = T.createTimer(settings());
    persist();
    renderSettings(state, settingsHandlers);
    renderStatic();
    showCoffee(true);
  },
};

function openSettings() {
  unlockAudio();
  tapSound();
  renderSettings(state, settingsHandlers);
  openSheet('settings');
}

// ---------------------------------------------------------------- keep the screen on

let wakeLock = null;
let wakePending = false;
async function syncWakeLock() {
  const want = state.settings.keepAwake && timer.status === 'running' && document.visibilityState === 'visible';
  if (want && !wakeLock && !wakePending && 'wakeLock' in navigator) {
    wakePending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
    wakePending = false;
  } else if (!want && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// ---------------------------------------------------------------- loop

let last = performance.now();
let renderAcc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tickTimer();
  renderTimer();
  cafe.update(dt);
  renderAcc += dt;
  // a quiet cafe only needs a few frames a second for the lights and the cat
  if (renderAcc >= (cafe.quiet ? 1 / 8 : 1 / 30)) {
    renderAcc = 0;
    cafe.render();
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot

function welcome() {
  if (state.welcomed) return;
  dialog({
    title: 'Bem-vindo ao Café Pomo!',
    text: 'Cada pomodoro de foco abre a cafeteria: os clientes chegam, a barista serve e você ganha moedas. Comece com o Espresso (5 moedas por pomodoro) e desbloqueie novos cafés no cardápio.',
    ok: 'Abrir o café',
    art: renderCoffee('espresso', 300),
  }).then(() => {
    unlockAudio();
    state = { ...state, welcomed: true };
    persist();
  });
}

function boot() {
  makeCoinIcon();
  makePaperGrain();
  initDialog();
  initSheets();
  setSoundEnabled(state.settings.sound);
  $('toggle').addEventListener('click', toggle);
  $('reset').addEventListener('click', resetTimer);
  $('skip').addEventListener('click', skipPhase);
  $('coins').addEventListener('click', openShop);
  $('open-shop').addEventListener('click', openShop);
  $('coffee').addEventListener('click', openShop);
  $('coffee-tag').addEventListener('click', openShop);
  $('open-settings').addEventListener('click', openSettings);
  $('reset-progress').addEventListener('click', () => settingsHandlers.onResetProgress());
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && document.querySelectorAll('.sheet:not([hidden]), .dialog:not([hidden])').length === 0) {
      e.preventDefault();
      toggle();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tickTimer();
      renderTimer();
    } else persist();
    syncWakeLock();
  });
  window.addEventListener('pagehide', persist);
  window.addEventListener('resize', layout);
  layout();
  // catch up on anything that finished while the app was closed
  tickTimer();
  renderStatic();
  if (document.fonts?.ready) document.fonts.ready.then(layout);
  requestAnimationFrame(frame);
  welcome();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !params.has('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__cafe = { cafe, get state() { return state; }, get timer() { return timer; } };
}

boot();
