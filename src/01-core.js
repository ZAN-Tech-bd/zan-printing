'use strict';
/* =====================================================================
   ZAN Print Lab — frontend-only prototype
   01 core: utilities, time, icons, overlays, toasts, regions, fake API
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MB = 1048576, MIN = 60000, HOUR = 3600000, DAY = 86400000;
const TZ = 'Asia/Dhaka', TZ_OFF = 6 * HOUR;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);

/* ---------- time (virtual clock lives in S.now) ---------- */
const _fm = {};
function _f(key, loc, o) { return _fm[key] || (_fm[key] = new Intl.DateTimeFormat(loc, { timeZone: TZ, ...o })); }
const fmtTime = ms => _f('t', 'en-US', { hour: 'numeric', minute: '2-digit' }).format(ms);
const fmtDate = ms => _f('d', 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(ms).replace(',', '');
const fmtDateLong = ms => _f('dl', 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(ms).replace(',', '');
const dayKey = ms => _f('k', 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
const startOfDay = ms => Math.floor((ms + TZ_OFF) / DAY) * DAY - TZ_OFF;
const dow = ms => new Date(ms + TZ_OFF).getUTCDay(); // 0 Sun … 6 Sat
const dayDiff = ms => Math.round((startOfDay(ms) - startOfDay(S.now)) / DAY);
function relDay(ms) { const d = dayDiff(ms); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : fmtDate(ms); }
const fmtWhen = ms => `${relDay(ms)}, ${fmtTime(ms)}`;
function timeInput(ms) { const d = new Date(ms + TZ_OFF); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
function fromInputs(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number); const [h, mi] = (timeStr || '09:00').split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) - TZ_OFF;
}
function atTime(dayMs, hhmm) { const [h, m] = hhmm.split(':').map(Number); return startOfDay(dayMs) + h * HOUR + m * MIN; }
function ago(ms) {
  const s = Math.max(0, (S.now - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
}
function fmtEta(sec) {
  if (sec < 45) return 'under 1 min';
  if (sec < 3600) return `~${Math.max(1, Math.round(sec / 60))} min`;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return `~${h} h${m ? ' ' + m + ' min' : ''}`;
}
function fmtSize(b) { return b >= MB ? (b / MB).toFixed(b >= 10 * MB ? 1 : 1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
const fmtMB = b => (b / MB).toFixed(1);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------- icons ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  printer: '<path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  queue: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.2 2.8 7.8 7 9 4.2-1.2 7-4.8 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M4 20l1.3-4.2A8.5 8.5 0 1 1 8.200 18.800z"/><path d="M9 9.500c0 3 2.500 5.500 5.500 5.500"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="2"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
  wifi: '<path d="M2.500 9a14 14 0 0 1 19 0M5.500 12.500a9.500 9.500 0 0 1 13 0M8.700 16a5 5 0 0 1 6.600 0"/><path d="M12 19.500h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  grip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.300"/><circle cx="15" cy="6" r="1.300"/><circle cx="9" cy="12" r="1.300"/><circle cx="15" cy="12" r="1.300"/><circle cx="9" cy="18" r="1.300"/><circle cx="15" cy="18" r="1.300"/></g>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.500-4M4 5v3.500h3.500"/><path d="M4 13a8 8 0 0 0 14.500 4M20 19v-3.500h-3.500"/>',
  alert: '<path d="M12 4 2.800 19.500h18.400z"/><path d="M12 10v4.500M12 17.500h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.500M12 7.500h.01"/>',
  pin: '<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>',
  copy: '<rect x="8.500" y="8.500" width="11" height="12" rx="2"/><path d="M15.500 8.500v-3a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.500c1-4 4-5.500 8-5.500s7 1.500 8 5.500"/>',
  users: '<circle cx="9" cy="8.500" r="3.500"/><path d="M2.500 19.500c.8-3.300 3.200-4.800 6.500-4.800s5.700 1.500 6.500 4.800"/><path d="M16 5.200a3.500 3.500 0 0 1 0 6.600M18 15c2 .6 3.200 2 3.600 4.500"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  login: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 8l-4 4 4 4M5 12h10"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  zap: '<path d="M13 3 5 13.500h6L10 21l8-10.500h-6z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  image: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.500"/><circle cx="9" cy="10" r="1.800"/><path d="m4 18 5-5 4 4 3-3 4.500 4"/>',
  grid: '<rect x="4" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.500 6h.01M4.500 12h.01M4.500 18h.01"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  wrench: '<path d="M15 5.500a4 4 0 0 0-5 5L4 16.500 7.500 20l6-6a4 4 0 0 0 5-5l-2.500 2.500-2.500-.5-.5-2.500z"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  database: '<ellipse cx="12" cy="6" rx="7.500" ry="3"/><path d="M4.500 6v6c0 1.700 3.400 3 7.500 3s7.500-1.300 7.500-3V6M4.500 12v6c0 1.700 3.400 3 7.500 3s7.500-1.300 7.500-3v-6"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.500-5.800M4 4v4h4"/><path d="M12 8v4l3 2"/>',
  box: '<path d="m12 3 8.500 4.500v9L12 21l-8.500-4.500v-9z"/><path d="m3.500 7.500 8.500 4.500 8.500-4.500M12 12v9"/>',
  droplet: '<path d="M12 3.500s6 6.200 6 10.500a6 6 0 0 1-12 0C6 9.700 12 3.500 12 3.500z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  flask: '<path d="M9 3h6M10 3v6l-5.500 9.500A2 2 0 0 0 6.200 21.500h11.600a2 2 0 0 0 1.700-3L14 9V3"/><path d="M7.500 15h9"/>',
  more: '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.500"/><circle cx="12" cy="12" r="1.500"/><circle cx="19" cy="12" r="1.500"/></g>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.600 5.600 12.800 12.800"/>',
  send: '<path d="M21 3 10 14M21 3l-6.500 18-4-7.500L3 9.500z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  tray: '<path d="M3 13h5l1.500 3h5L16 13h5"/><path d="M5 13 7 5h10l2 8v6H5z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.500 2.500M15.500 15.500 18 18M18 6l-2.500 2.500M8.500 15.500 6 18"/>',
  star: '<path d="m12 3.500 2.600 5.300 5.800.8-4.200 4.100 1 5.800L12 16.800l-5.200 2.700 1-5.800L3.600 9.600l5.800-.8z"/>'
};
function ic(name, cls = '') { return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`; }
function iconSprite() { return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('')}</defs></svg>`; }
function logoMark(size = 36) {
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="var(--primary)"/><path d="M12 12.500h16L12 27.500h16" fill="none" stroke="#fff" stroke-width="3.200" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30.500" cy="30" r="3.200" fill="var(--spark)"/></svg>`;
}

/* ---------- registries & global state holders ---------- */
const actions = {};   // click handlers by data-act
const inputs = {};    // input/change handlers by data-in
const REGIONS = {};   // region name -> () => html
let S = null;         // app data (seeded in 02-seed.js)
const demo = { net: 'lan', speed: 6, paused: false, apiMode: 'normal' };
const ui = {
  view: 'home', loaded: new Set(), loadErr: null, loading: false,
  filesQ: '', filesType: 'all', filesSort: 'new', filesLayout: 'grid', filesSel: new Set(), selectMode: false,
  plannerDay: 'all', queueScope: 'all', queueFilter: 'all',
  adminTab: 'overview', auditQ: '', auditCat: 'all', auditRes: 'all', auditN: 20, auditOpen: null, usersQ: '', adminQueueFilter: 'active',
  studio: null, taskEdit: null, gate: { mode: 'choose', err: null, busy: false, detecting: true, tries: 0 },
  notifOpen: false, demoOpen: false, waOpen: false, admDays: 14
};

/* ---------- region refresh with focus preservation ---------- */
function reg(name, attrs = '') { return `<div data-region="${name}" ${attrs}>${REGIONS[name] ? REGIONS[name]() : ''}</div>`; }
function focusSig(a) {
  if (a.id) return '#' + CSS.escape(a.id);
  const parts = ['act', 'id', 'uid', 'v', 'k', 'n', 'o', 'i'].filter(k => a.dataset && a.dataset[k] != null).map(k => `[data-${k}="${CSS.escape(a.dataset[k])}"]`);
  return parts.length ? a.tagName.toLowerCase() + parts.join('') : null;
}
function setHTMLKeepFocus(el, html) {
  const a = document.activeElement; let sig = null, s = null, e = null;
  if (a && a !== document.body && el.contains(a)) { sig = focusSig(a); try { s = a.selectionStart; e = a.selectionEnd; } catch (_) { } }
  const sy = el.scrollTop;
  el.innerHTML = html; el.scrollTop = sy;
  if (sig) { let n = null; try { n = el.querySelector(sig); } catch (_) { } if (n) { n.focus({ preventScroll: true }); try { if (s != null) n.setSelectionRange(s, e); } catch (_) { } } }
}
function refresh(...names) {
  for (const n of names) {
    const els = $$(`[data-region="${n}"]`); if (!els.length || !REGIONS[n]) continue;
    const html = REGIONS[n]();
    els.forEach(el => setHTMLKeepFocus(el, html));
  }
}

/* ---------- toasts ---------- */
const toastActs = {};
function toast({ msg, kind = 'info', action = null, ttl = 5200 }) {
  const box = $('#toasts'); if (!box) return;
  const id = uid('t'); if (action) toastActs[id] = action.fn;
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.dataset.id = id;
  el.innerHTML = `<span class="toast-ic">${ic(kind === 'good' ? 'check' : kind === 'bad' ? 'alert' : kind === 'warn' ? 'alert' : 'info')}</span><span class="toast-msg">${esc(msg)}</span>${action ? `<button class="toast-act" data-act="toast-act" data-id="${id}">${esc(action.label)}</button>` : ''}<button class="toast-x" aria-label="Dismiss" data-act="toast-x">${ic('x')}</button>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  if (ttl) setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, ttl);
}
actions['toast-act'] = el => { const f = toastActs[el.dataset.id]; el.closest('.toast').remove(); if (f) f(); };
actions['toast-x'] = el => el.closest('.toast').remove();

/* ---------- overlays (sheet / dialog / drawer) ---------- */
const OV = []; // stack
function focusables(root) { return $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', root).filter(n => n.offsetParent !== null || n === document.activeElement); }
function openOverlay({ id, kind = 'sheet', title, sub = '', render, onClose, wide = false }) {
  closeOverlay(id, true);
  const root = $('#overlays');
  const wrap = document.createElement('div');
  wrap.className = 'ov'; wrap.dataset.ov = id;
  wrap.innerHTML = `<div class="ov-scrim" data-act="ov-close" data-id="${id}"></div>
  <section class="ov-panel ${kind} ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="ovt-${id}">
    <header class="ov-head"><div><h2 id="ovt-${id}">${esc(title)}</h2>${sub ? `<p class="muted sm">${esc(sub)}</p>` : ''}</div><button class="icon-btn" data-act="ov-close" data-id="${id}" aria-label="Close">${ic('x')}</button></header>
    <div class="ov-body" data-ovb="${id}"></div><footer class="ov-foot" data-ovf="${id}"></footer></section>`;
  root.appendChild(wrap);
  const rec = { id, render, onClose, opener: document.activeElement, el: wrap };
  OV.push(rec); paintOverlay(rec);
  document.body.classList.add('has-ov');
  requestAnimationFrame(() => { wrap.classList.add('in'); const b = $('.ov-body', wrap); const f = focusables(b)[0] || $('.ov-panel', wrap); (f || wrap).focus?.({ preventScroll: true }); });
  return rec;
}
function paintOverlay(rec) {
  const out = rec.render(); const b = $(`[data-ovb="${rec.id}"]`, rec.el), f = $(`[data-ovf="${rec.id}"]`, rec.el);
  setHTMLKeepFocus(b, out.body || ''); f.innerHTML = out.foot || ''; f.style.display = out.foot ? '' : 'none';
}
function refreshOverlay(id) { const r = OV.find(o => o.id === id); if (r) paintOverlay(r); }
function closeOverlay(id, silent = false) {
  const i = OV.findIndex(o => o.id === id); if (i < 0) return;
  const rec = OV.splice(i, 1)[0]; rec.el.classList.remove('in');
  setTimeout(() => rec.el.remove(), 180);
  if (!OV.length) document.body.classList.remove('has-ov');
  if (!silent) { try { rec.onClose && rec.onClose(); } catch (e) { console.error(e); } rec.opener && rec.opener.focus && document.body.contains(rec.opener) && rec.opener.focus({ preventScroll: true }); }
}
const topOverlay = () => OV[OV.length - 1];
actions['ov-close'] = el => closeOverlay(el.dataset.id);
function confirmDialog({ title, body, confirm = 'Confirm', danger = false, onConfirm, cancel = 'Keep it' }) {
  const id = 'confirm';
  openOverlay({ id, kind: 'dialog', title, render: () => ({ body: `<div class="prose">${body}</div>`, foot: `<button class="btn ghost" data-act="ov-close" data-id="${id}">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-yes">${esc(confirm)}</button>` }) });
  actions['confirm-yes'] = el => { closeOverlay(id); onConfirm && onConfirm(); };
}

/* ---------- popover menu ---------- */
let menuRec = null;
function openMenu(anchor, items, { title = '' } = {}) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  if (title) m.innerHTML = `<div class="menu-title">${esc(title)}</div>`;
  m.innerHTML += items.map(it => it.sep ? '<hr/>' : `<button role="menuitem" class="menu-item ${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''} data-act="${it.act}" ${Object.entries(it.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let left = clamp(r.right - mw, 8, innerWidth - mw - 8), top = r.bottom + 6;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  menuRec = { el: m, anchor }; anchor.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => { m.classList.add('in'); const f = $('.menu-item:not([disabled])', m); f && f.focus({ preventScroll: true }); });
}
function closeMenu() { if (!menuRec) return; menuRec.anchor.removeAttribute('aria-expanded'); const a = menuRec.anchor; menuRec.el.remove(); menuRec = null; if (document.body.contains(a)) try { a.focus({ preventScroll: true }); } catch (_) { } }

/* ---------- busy buttons + fake API ---------- */
async function withBusy(el, p) {
  if (el) { el.classList.add('is-busy'); el.setAttribute('aria-busy', 'true'); el.disabled = true; }
  try { return await p; } finally { if (el && document.body.contains(el)) { el.classList.remove('is-busy'); el.removeAttribute('aria-busy'); el.disabled = false; } }
}
class ApiError extends Error { }
async function api(label, fn, ms) {
  await sleep(ms ?? rand(280, 620));
  if (demo.apiMode === 'outage' || (demo.apiMode === 'flaky' && Math.random() < 0.4)) throw new ApiError(`${label} didn't go through. The print server isn't responding.`);
  return fn();
}
/* run(): api call + error toast with Retry. onOk fires on first success or on retry success. */
async function run(label, fn, { ms, onOk, onFail, btn } = {}) {
  try {
    const res = await withBusy(btn, api(label, fn, ms));
    onOk && onOk(res); return res;
  } catch (e) {
    if (!(e instanceof ApiError)) { console.error(e); }
    toast({ kind: 'bad', msg: e.message || 'Something went wrong.', action: { label: 'Retry', fn: () => run(label, fn, { ms, onOk, onFail, btn: null }) }, ttl: 9000 });
    onFail && onFail(e);
  }
}
