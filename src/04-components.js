/* =====================================================================
   04 components: shared render helpers
   ===================================================================== */
const STATUS_META = {
  'Scheduled': { ic: 'calendar', cls: 'st-sched' }, 'Queued': { ic: 'queue', cls: 'st-queued' }, 'Printing': { ic: 'printer', cls: 'st-printing' },
  'Ready for Collection': { ic: 'box', cls: 'st-ready' }, 'Collected': { ic: 'check', cls: 'st-done' }, 'Failed': { ic: 'alert', cls: 'st-failed' }, 'Cancelled': { ic: 'ban', cls: 'st-cancel' }
};
const pill = s => `<span class="pill ${STATUS_META[s].cls}">${ic(STATUS_META[s].ic)}<span>${s}</span></span>`;
const chip = (t, cls = '', icon = '') => `<span class="chip ${cls}">${icon ? ic(icon) : ''}${esc(t)}</span>`;
function avatar(u, size = 34) { const h = hashStr(u.name) % 360; return `<span class="avatar" style="--h:${h};width:${size}px;height:${size}px;font-size:${Math.round(size * .38)}px" aria-hidden="true">${esc(u.name.split(' ').map(x => x[0]).slice(0, 2).join(''))}</span>`; }
function bar(p, cls = '', label = '') { p = clamp(p, 0, 100); return `<div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}" ${label ? `aria-label="${esc(label)}"` : ''}><i style="width:${p}%"></i></div>`; }
function ring(p, size = 96, label = '') {
  const r = 40, c = 2 * Math.PI * r, lvl = p >= 95 ? 'bad' : p >= 80 ? 'warn' : 'ok';
  return `<div class="ring ${lvl}" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(label || p + '% used')}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="ring-bg"/><circle cx="50" cy="50" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(p, 0, 100) / 100)}" transform="rotate(-90 50 50)"/></svg><b>${Math.round(p)}<small>%</small></b></div>`;
}
const waFmt = t => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
function emptyState({ icon = 'file', title, body, cta = '' }) { return `<div class="empty"><div class="empty-ic">${ic(icon)}</div><h3>${title}</h3><p>${body}</p>${cta ? `<div class="row center wrap">${cta}</div>` : ''}</div>`; }
function errorState(msg, act = 'reload-view') { return `<div class="empty err" role="alert"><div class="empty-ic">${ic('alert')}</div><h3>Couldn't load this page</h3><p>${esc(msg)}</p><div class="row center"><button class="btn primary" data-act="${act}">${ic('refresh')}Try again</button></div></div>`; }
function skel(kind = 'cards') {
  const c = n => Array.from({ length: n }, () => '<div class="skel-card"><i class="sk w40"></i><i class="sk w80"></i><i class="sk w60"></i></div>').join('');
  if (kind === 'list') return `<div class="skel-wrap" aria-busy="true" aria-label="Loading">${Array.from({ length: 6 }, () => '<div class="skel-row"><i class="sk sq"></i><div><i class="sk w60"></i><i class="sk w30"></i></div><i class="sk w15"></i></div>').join('')}</div>`;
  return `<div class="skel-wrap grid" aria-busy="true" aria-label="Loading">${c(6)}</div>`;
}
const KIND_LABEL = { doc: 'Document', sheet: 'Spreadsheet', img: 'Image', slides: 'Slides' };
function fileTile(x, cls = '') { return `<span class="ftile ${cls}" style="--h:${x.hue}" aria-hidden="true">${ic(x.kind === 'img' ? 'image' : 'file')}<b>${esc((x.ext || '').slice(0, 4).toUpperCase())}</b></span>`; }

/* ---------- mock document pages (so colour / grayscale / orientation previews are real) ---------- */
function naturalOrient(it) { return it.kind === 'slides' ? 'landscape' : it.kind === 'img' && hashStr(it.name) % 2 === 0 ? 'landscape' : 'portrait'; }
function effOrient(it, st) { return st.orient === 'auto' ? naturalOrient(it) : st.orient; }
function mockPage(it, n) {
  if (it.blobUrl && it.kind === 'img') return `<img class="pg-img" src="${it.blobUrl}" alt="Preview of ${esc(it.name)}">`;
  const R = mulberry(hashStr(it.name) + n * 977), h = it.hue, lines = (k, min = 62) => Array.from({ length: k }, () => `<i style="width:${Math.round(min + R() * (100 - min))}%"></i>`).join('');
  const title = it.name.replace(/\.[a-z0-9]+$/i, '');
  if (it.kind === 'img') return `<div class="pg pg-photo" style="--h:${h}"><span class="sun"></span><span class="hill a"></span><span class="hill b"></span></div>`;
  if (it.kind === 'sheet') {
    const rows = Array.from({ length: 15 }, (_, r) => `<div class="tr ${r === 0 ? 'th' : ''}">${Array.from({ length: 5 }, (_, c) => `<span>${r === 0 || R() > .25 ? `<i style="width:${40 + Math.round(R() * 55)}%"></i>` : ''}</span>`).join('')}</div>`).join('');
    return `<div class="pg pg-sheet" style="--h:${h}"><div class="pg-title">${esc(title)}</div>${rows}<em>${n}</em></div>`;
  }
  if (it.kind === 'slides') return `<div class="pg pg-slide" style="--h:${h}"><div class="band"></div><div class="pg-title big">${esc(title)}</div><div class="cols"><div class="tx">${lines(5)}</div><div class="fig"><span></span><span></span></div></div><em>${n}</em></div>`;
  if (n === 1) return `<div class="pg pg-doc" style="--h:${h}"><div class="banner"><span>${esc(title)}</span></div><div class="tx sm">${lines(2, 40)}</div><div class="cols"><div class="tx">${lines(7)}</div><div class="fig"><span></span><span></span></div></div><div class="tx">${lines(5)}</div><em>${n}</em></div>`;
  const fig = R() > .45 ? `<div class="fig wide"><span></span><span></span></div>` : `<div class="tbl">${Array.from({ length: 4 }, (_, r) => `<div class="tr ${r === 0 ? 'th' : ''}"><span></span><span></span><span></span></div>`).join('')}</div>`;
  return `<div class="pg pg-doc" style="--h:${h}"><div class="h2"></div><div class="tx">${lines(6)}</div>${fig}<div class="tx">${lines(5)}</div><em>${n}</em></div>`;
}
function paperHTML(it, n, st, { thumb = false, skipped = false } = {}) {
  const o = effOrient(it, st), base = PAPER_AR[st.paper] || 1.414, ar = o === 'landscape' ? base : 1 / base;
  return `<div class="paper ${st.color === 'bw' ? 'bw' : ''} ${o} ${skipped ? 'skipped' : ''} ${thumb ? 'thumb' : ''}" style="--ar:${ar.toFixed(4)}">${mockPage(it, n)}${skipped ? '<span class="skip-tag">Skipped</span>' : ''}</div>`;
}

/* ---------- settings form (shared by Studio and Planner editor) ---------- */
const scopeState = sc => sc === 'studio' ? ui.studio : ui.taskEdit;
const scopeRefresh = { studio: () => refresh('studioSettings', 'studioPreview', 'studioSummary', 'studioBar', 'studioRoute'), task: () => refreshOverlay('task') };
function seg(scope, key, opts, val, { label = '' } = {}) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(o => `<button type="button" role="radio" class="${o.v === val ? 'on' : ''}" aria-checked="${o.v === val}" ${o.dis ? 'disabled' : ''} data-act="set" data-scope="${scope}" data-k="${key}" data-v="${o.v}">${o.ic ? ic(o.ic) : ''}<span>${o.l}</span></button>`).join('')}</div>`;
}
const PRESETS = [
  { id: 'eco', l: 'Everyday eco', d: 'A4 · grayscale · double-sided', s: { paper: 'A4', color: 'bw', orient: 'auto', duplex: 'long' } },
  { id: 'col', l: 'Colour handout', d: 'A4 · colour · single-sided', s: { paper: 'A4', color: 'color', orient: 'auto', duplex: 'single' } },
  { id: 'poster', l: 'Poster', d: 'A3 · colour · single-sided', s: { paper: 'A3', color: 'color', orient: 'auto', duplex: 'single' } }
];
function settingsForm(scope) {
  const st = scopeState(scope).settings, avail = p => S.printers.some(x => x.caps.paper.includes(p));
  return `<div class="presets" role="group" aria-label="Quick presets">${PRESETS.map(p => `<button type="button" class="preset ${Object.keys(p.s).every(k => st[k] === p.s[k]) ? 'on' : ''}" data-act="preset" data-scope="${scope}" data-id="${p.id}"><b>${p.l}</b><small>${p.d}</small></button>`).join('')}</div>
  <div class="field"><label class="lbl" id="l-paper-${scope}">Paper size</label>${seg(scope, 'paper', ['A4', 'A3', 'A5', 'Letter', 'Legal'].map(v => ({ v, l: v, dis: !avail(v) })), st.paper, { label: 'Paper size' })}</div>
  <div class="field"><label class="lbl">Colour</label>${seg(scope, 'color', [{ v: 'bw', l: 'Grayscale' }, { v: 'color', l: 'Colour' }], st.color, { label: 'Colour mode' })}</div>
  <div class="field"><label class="lbl">Orientation</label>${seg(scope, 'orient', [{ v: 'auto', l: 'Auto' }, { v: 'portrait', l: 'Portrait' }, { v: 'landscape', l: 'Landscape' }], st.orient, { label: 'Orientation' })}</div>
  <div class="field"><label class="lbl">Sides</label>${seg(scope, 'duplex', [{ v: 'single', l: 'Single' }, { v: 'long', l: 'Double' }, { v: 'short', l: 'Double, short edge' }], st.duplex, { label: 'Sides' })}</div>`;
}
actions['set'] = el => { const s = scopeState(el.dataset.scope); s.settings[el.dataset.k] = el.dataset.v; scopeRefresh[el.dataset.scope](); };
actions['preset'] = el => { const s = scopeState(el.dataset.scope), p = PRESETS.find(x => x.id === el.dataset.id); Object.assign(s.settings, p.s); scopeRefresh[el.dataset.scope](); };

/* ---------- job presentation ---------- */
const jobName = j => (isMine(j) || isAdmin()) ? jobTitle(j) : `Job ${j.order}`;
const shortSettings = st => `${st.paper} · ${st.color === 'color' ? 'Colour' : 'B/W'}${st.duplex !== 'single' ? ' · 2-sided' : ''}`;
function etaLabel(j) {
  const p = printerById(j.printer);
  if (j.status === 'Queued') { if (!p) return 'Waiting for a compatible printer'; if (!printerOk(p)) return `Waiting: ${p.name} is ${pStatusLabel(p).toLowerCase()}`; return `#${queuePos(j)} in line · ${fmtEta(jobEtaSec(j))}`; }
  if (j.status === 'Printing') return `${fmtEta(jobEtaSec(j) ?? 0)} left`;
  if (j.status === 'Ready for Collection') return `Shelf ${j.shelf} · ${ago(j.readyAt)}`;
  if (j.status === 'Scheduled') return fmtWhen(j.scheduled);
  if (j.status === 'Failed') return j.fail ? j.fail.reason : 'Failed';
  if (j.status === 'Collected') return ago(j.collectedAt);
  return ago(j.events[j.events.length - 1].t);
}
function jobRow(j, { owner = false, quick = true } = {}) {
  const mine = isMine(j), p = printerById(j.printer), prog = pct(j.done, j.impressions);
  const own = owner ? userById(j.owner) : null;
  return `<article class="job ${mine ? 'mine' : ''} s-${STATUS_META[j.status].cls}" role="button" tabindex="0" data-act="job-open" data-id="${j.id}" aria-label="${esc(jobName(j))}, ${j.status}">
    <div class="job-ic">${ic(STATUS_META[j.status].ic)}</div>
    <div class="job-main"><div class="job-top"><b class="job-title">${esc(jobName(j))}</b>${mine && !isAdmin() ? '<span class="chip you">You</span>' : ''}</div>
      <div class="job-meta"><code>${j.order}</code><span>${plural(j.sheets, 'sheet')}</span><span>${shortSettings(j.settings)}</span>${p ? `<span>${esc(p.name)}</span>` : ''}${own ? `<span>${esc(own.name)}</span>` : j.guest && isAdmin() ? '<span>Guest</span>' : ''}</div>
      ${j.status === 'Printing' ? `<div class="job-prog">${bar(prog, 'live', `Printing ${prog}%`)}<span>${prog}%</span></div>` : ''}</div>
    <div class="job-side">${pill(j.status)}<small class="${j.status === 'Failed' ? 'bad-t' : ''}">${esc(etaLabel(j))}</small></div></article>`;
}
function storageSegs(u) {
  const q = u.quota, files = userFiles(u.id), by = { doc: 0, sheet: 0, img: 0, slides: 0 };
  files.forEach(f => by[f.kind] += f.size); const other = u.usedStatic || 0;
  const seg = (k, v) => v > 0 ? `<i class="k-${k}" style="width:${v / q * 100}%" title="${KIND_LABEL[k] || 'Other'} ${fmtMB(v)} MB"></i>` : '';
  return seg('doc', by.doc) + seg('slides', by.slides) + seg('sheet', by.sheet) + seg('img', by.img) + seg('other', other);
}
function storageBar(u) {
  const used = usedBytes(u), p = pct(used, u.quota), lvl = p >= 95 ? 'bad' : p >= 80 ? 'warn' : 'ok';
  return `<div class="sbar ${lvl}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="Storage used ${p} percent">${storageSegs(u)}<span class="mark m80" title="80% warning"></span><span class="mark m95" title="95% critical"></span></div>`;
}
const fileMeta = f => `${f.pages ? plural(f.pages, 'page') + ' · ' : ''}${fmtSize(f.size)}`;
