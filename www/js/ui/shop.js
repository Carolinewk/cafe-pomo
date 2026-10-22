// The coffee menu: buy new drinks with coins and pick which one the barista serves.

import { COFFEES } from '../catalog.js';
import { renderCoffee } from '../art/coffees.js';
import { rewardFor, canBuy } from '../store.js';

const coinIcon = () => {
  const s = document.createElement('span');
  s.className = 'coin-icon';
  s.setAttribute('aria-hidden', 'true');
  return s;
};

function artCanvas(id, owned, cssSize) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = Math.round(cssSize * dpr);
  const src = renderCoffee(id, px, { mono: !owned });
  const c = document.createElement('canvas');
  c.className = 'art';
  c.width = px;
  c.height = px;
  c.getContext('2d').drawImage(src, 0, 0);
  c.setAttribute('role', 'img');
  return c;
}

/**
 * Render the menu grid.
 * handlers: { onBuy(id), onSelect(id) }; `fresh` is a drink just bought (plays the unlock animation).
 */
export function renderShop(grid, state, handlers, fresh = null) {
  const cards = COFFEES.map((c) => {
    const owned = state.owned.includes(c.id);
    const selected = state.selected === c.id;
    const card = document.createElement('article');
    card.className = `card${owned ? ' owned' : ' locked'}${selected ? ' selected' : ''}${fresh === c.id ? ' unlocking' : ''}`;
    const art = artCanvas(c.id, owned, 132);
    art.setAttribute('aria-label', owned ? c.name : `${c.name} (bloqueado)`);
    const h = document.createElement('h3');
    h.textContent = c.name;
    const earn = document.createElement('p');
    earn.className = 'earn';
    earn.append(`+${rewardFor(c.id, state.settings.focus)}`, coinIcon(), ' por pomodoro');
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = c.note;
    const action = document.createElement('div');
    action.className = 'action';
    const btn = document.createElement('button');
    btn.type = 'button';
    if (selected) {
      btn.className = 'pill-btn serving';
      btn.textContent = 'Servindo ✓';
      btn.disabled = true;
    } else if (owned) {
      btn.className = 'pill-btn';
      btn.textContent = 'Servir';
      btn.addEventListener('click', () => handlers.onSelect(c.id));
    } else {
      const check = canBuy(state, c.id);
      btn.className = 'pill-btn buy';
      btn.append(coinIcon(), String(c.price));
      btn.setAttribute('aria-label', `Comprar ${c.name} por ${c.price} moedas`);
      if (check.ok) btn.addEventListener('click', () => handlers.onBuy(c.id));
      else {
        btn.disabled = true;
        const miss = document.createElement('span');
        miss.className = 'missing';
        miss.textContent = `faltam ${check.missing}`;
        action.append(btn, miss);
      }
    }
    if (!action.contains(btn)) action.prepend(btn);
    card.append(art, h, earn, note, action);
    return card;
  });
  grid.replaceChildren(...cards);
}
