// A small promise-based dialog and a self-dismissing banner, styled like the rest of the app.

const $ = (id) => document.getElementById(id);

let resolver = null;

/** Show a dialog. Resolves true for the main button, false for cancel. */
export function dialog({ title, text, ok = 'Ok', cancel = null, art = null, danger = false }) {
  const root = $('dialog');
  $('dialog-title').textContent = title;
  $('dialog-text').textContent = text;
  const okBtn = $('dialog-ok');
  const cancelBtn = $('dialog-cancel');
  okBtn.textContent = ok;
  okBtn.style.background = danger ? '#c8695a' : '';
  cancelBtn.hidden = !cancel;
  if (cancel) cancelBtn.textContent = cancel;
  const artCanvas = $('dialog-art');
  if (art) {
    artCanvas.width = art.width;
    artCanvas.height = art.height;
    artCanvas.getContext('2d').drawImage(art, 0, 0);
    artCanvas.hidden = false;
  } else artCanvas.hidden = true;
  if (resolver) resolver(false);
  root.hidden = false;
  okBtn.focus({ preventScroll: true });
  return new Promise((resolve) => {
    resolver = (value) => {
      resolver = null;
      root.hidden = true;
      resolve(value);
    };
  });
}

export function initDialog() {
  $('dialog-ok').addEventListener('click', () => resolver?.(true));
  $('dialog-cancel').addEventListener('click', () => resolver?.(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && resolver) resolver(false);
  });
}

let bannerTimer = 0;

/** Slide a little card in from the top. `icon` may be a canvas. */
export function banner(title, sub, { icon = null, ms = 4200, subHtml = null } = {}) {
  const el = $('banner');
  $('banner-title').textContent = title;
  const subEl = $('banner-sub');
  if (subHtml) subEl.replaceChildren(...subHtml);
  else subEl.textContent = sub;
  const iconEl = $('banner-icon');
  iconEl.replaceChildren();
  if (icon) {
    const c = document.createElement('canvas');
    c.width = icon.width;
    c.height = icon.height;
    c.getContext('2d').drawImage(icon, 0, 0);
    iconEl.append(c);
  }
  el.classList.remove('leaving');
  el.hidden = false;
  // restart the drop animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    el.classList.add('leaving');
    bannerTimer = setTimeout(() => {
      el.hidden = true;
      el.classList.remove('leaving');
    }, 360);
  }, ms);
}

/** Open a bottom sheet; resolves when it closes. */
export function openSheet(id) {
  const sheet = $(id);
  sheet.hidden = false;
  sheet.classList.remove('closing');
  return sheet;
}

export function closeSheet(id) {
  const sheet = $(id);
  if (sheet.hidden || sheet.classList.contains('closing')) return;
  sheet.classList.add('closing');
  setTimeout(() => {
    sheet.hidden = true;
    sheet.classList.remove('closing');
  }, 240);
}

export function initSheets() {
  for (const sheet of document.querySelectorAll('.sheet')) {
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeSheet(sheet.id);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const sheet of document.querySelectorAll('.sheet:not([hidden])')) closeSheet(sheet.id);
  });
}
