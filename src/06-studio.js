/* =====================================================================
   06 Print Studio
   ===================================================================== */
function newStudio() {
  const u = me(), last = u ? u.prefs.last : { paper: 'A4', color: 'bw', orient: 'auto', duplex: 'long' };
  return { items: [], sel: null, page: 1, settings: { ...last }, printerPref: 'auto', save: u ? u.prefs.save : false, notifyWa: !!(u && u.wa.connected), guestName: '', errors: [], dragUid: null };
}
const selItem = () => ui.studio.items.find(i => i.uid === ui.studio.sel) || ui.studio.items[0] || null;
const itemFromFile = f => ({ uid: uid('i'), fileId: f.id, name: f.name, ext: f.ext, kind: f.kind, hue: f.hue, size: f.size, pages: f.pages, est: f.est, blobUrl: f.blobUrl || null, range: '', copies: 1, state: 'ready', progress: 100 });
const studioReady = () => ui.studio.items.filter(i => i.state === 'ready');
function studioTotals() { const s = ui.studio, items = studioReady(); return { ...totals(items, s.settings), n: items.length }; }
function studioIssues() {
  const s = ui.studio, out = [];
  if (!s.items.length) out.push('Add a file to print.');
  if (s.items.some(i => i.state === 'uploading')) out.push('Waiting for uploads to finish.');
  if (s.items.some(i => i.state === 'error')) out.push('Remove or retry the file that failed.');
  s.items.forEach(i => { if (i.state === 'ready' && !parseRange(i.range, i.pages).ok) out.push(`Fix the page range for ${i.name}.`); });
  if (s.items.length && !studioReady().length && !out.length) out.push('Add a file to print.');
  const route = studioRoute(); if (!route.p) out.push(route.msg);
  return out;
}
function studioRoute() {
  const s = ui.studio, t = studioTotals(), pseudo = { settings: s.settings, printerPref: s.printerPref };
  if (s.printerPref !== 'auto') { const sp = printerById(s.printerPref), is = printerIssues(sp, s.settings); if (is.length) return { p: null, msg: `${sp.name} ${is[0]}. Pick another printer or change the settings.` }; }
  const p = routePrinter(pseudo);
  if (!p) return { p: null, msg: 'No printer supports this combination. Try A4 or single-sided.' };
  const wait = printerWaitSec(p), dur = t.impressions / (p.ppm / 60);
  return { p, wait, dur, eta: wait == null ? null : wait + dur };
}

/* ---------- view ---------- */
VIEW_RENDER.studio = () => {
  if (!ui.studio) ui.studio = newStudio();
  const guest = isGuest();
  return `${pageHead('Print Studio', guest ? 'Guest printing' : 'Add files, check the preview, print.', `<button class="btn" data-act="pick-files">${ic('upload')}Add files</button>`)}
  ${guest ? `<div class="notice info guest-note">${ic('shield')}<div><b>Guest mode: nothing is saved.</b> Your files are deleted once printing starts, and no history is kept. <button class="link" data-act="guest-to-login">Sign in</button> to keep files and plan prints.</div></div>` : ''}
  <div class="studio">
    <section class="card st-files" aria-label="Files">${reg('studioFiles')}</section>
    <section class="card st-preview" aria-label="Preview">${reg('studioPreview')}</section>
    <section class="card st-settings" aria-label="Print settings"><h2 class="card-h">Settings</h2>${reg('studioSettings')}${reg('studioRoute')}${reg('studioSummary')}</section>
  </div>
  <div class="st-bar-wrap">${reg('studioBar')}</div>`;
};
REGIONS.studioFiles = () => {
  const s = ui.studio, u = me(); if (!s) return '';
  const errs = s.errors.length ? `<div class="notice bad" role="alert">${ic('alert')}<div>${s.errors.map(e => `<p>${esc(e)}</p>`).join('')}</div><button class="icon-btn sm" data-act="dismiss-errs" aria-label="Dismiss">${ic('x')}</button></div>` : '';
  if (!s.items.length) return `${errs}<div class="dropzone big" data-drop tabindex="0" role="button" data-act="pick-files" aria-label="Choose files to print, or drop them here">
      <div class="dz-ic">${ic('upload')}</div><h3>Drop files here</h3><p class="muted">or tap to browse. PDF, Word, PowerPoint, Excel, images and text, up to 50 MB each.</p></div>
    <div class="samples"><small class="muted">No files handy? Try a sample</small><div class="row wrap">${SAMPLES.map((x, i) => `<button class="chip btnchip" data-act="add-sample" data-i="${i}">${ic('file')}${esc(x.name.replace(/\.[a-z]+$/i, ''))}</button>`).join('')}</div></div>
    ${u ? `<button class="btn block ghost" data-act="studio-pick">${ic('folder')}Choose from My Files</button>` : ''}`;
  return `<div class="card-head"><h2 class="card-h">Files <span class="count">${s.items.length}</span></h2><div class="row"><button class="btn sm ghost" data-act="pick-files">${ic('plus')}Add</button>${u ? `<button class="btn sm ghost" data-act="studio-pick">${ic('folder')}My Files</button>` : ''}</div></div>${errs}
  <ul class="fi-list" aria-label="Files to print, in print order">${s.items.map((it, i) => fileRow(it, i, s.items.length)).join('')}</ul>
  <div class="dropzone slim" data-drop tabindex="0" role="button" data-act="pick-files">${ic('upload')}<span>Drop more files or browse</span></div>`;
};
function fileRow(it, i, n) {
  const sel = (selItem() || {}).uid === it.uid, r = it.state === 'ready' ? parseRange(it.range, it.pages) : { ok: true };
  return `<li class="fi ${sel ? 'sel' : ''} ${it.state}" draggable="true" data-uid="${it.uid}" aria-current="${sel}">
    <div class="fi-top"><span class="grip" aria-hidden="true">${ic('grip')}</span>${fileTile(it)}
      <button class="fi-name" data-act="fi-select" data-uid="${it.uid}"><b>${esc(it.name)}</b><small>${it.state === 'uploading' ? `Uploading ${Math.round(it.progress)}%` : it.state === 'error' ? 'Upload failed' : `${plural(it.pages, 'page')}${it.est ? ' (est.)' : ''} · ${fmtSize(it.size)}`}</small></button>
      <div class="fi-mv"><button class="icon-btn sm" data-act="fi-move" data-uid="${it.uid}" data-d="-1" aria-label="Move ${esc(it.name)} earlier" ${i === 0 ? 'disabled' : ''}>${ic('up')}</button><button class="icon-btn sm" data-act="fi-move" data-uid="${it.uid}" data-d="1" aria-label="Move ${esc(it.name)} later" ${i === n - 1 ? 'disabled' : ''}>${ic('down')}</button><button class="icon-btn sm" data-act="fi-remove" data-uid="${it.uid}" aria-label="Remove ${esc(it.name)}">${ic('x')}</button></div></div>
    ${it.state === 'uploading' ? bar(it.progress, 'live', 'Upload progress') : ''}
    ${it.state === 'error' ? `<div class="fi-err">${ic('alert')}<span>The upload didn't finish. Your file is still here.</span><button class="btn sm" data-act="fi-retry" data-uid="${it.uid}">${ic('refresh')}Retry</button></div>` : ''}
    ${it.state === 'ready' ? `<div class="fi-ctl"><div class="field"><label class="lbl" for="rng-${it.uid}">Pages</label><input id="rng-${it.uid}" class="input sm ${r.ok ? '' : 'invalid'}" data-in="range" data-uid="${it.uid}" value="${esc(it.range)}" placeholder="All ${it.pages}" inputmode="text" autocomplete="off" aria-describedby="rm-${it.uid}" aria-invalid="${!r.ok}"/></div>
      <div class="field"><label class="lbl" id="cl-${it.uid}">Copies</label><div class="stepper" role="group" aria-labelledby="cl-${it.uid}"><button class="icon-btn sm" data-act="copies" data-uid="${it.uid}" data-d="-1" aria-label="Fewer copies" ${it.copies <= 1 ? 'disabled' : ''}>${ic('minus')}</button><input id="cp-${it.uid}" class="input sm num" type="number" min="1" max="500" value="${it.copies}" data-in="copies" data-uid="${it.uid}" inputmode="numeric" aria-label="Copies of ${esc(it.name)}"/><button class="icon-btn sm" data-act="copies" data-uid="${it.uid}" data-d="1" aria-label="More copies">${ic('plus')}</button></div></div></div>
      <p class="field-msg ${r.ok ? '' : 'bad-t'}" id="rm-${it.uid}">${r.ok ? '' : esc(r.err)}</p>` : ''}</li>`;
}
REGIONS.studioPreview = () => {
  const s = ui.studio; if (!s) return '';
  const it = selItem();
  if (!it) return `<h2 class="card-h">Preview</h2><div class="pv-empty">${paperHTML({ name: 'Preview', kind: 'doc', hue: 222, pages: 1 }, 1, { paper: s.settings.paper, color: s.settings.color, orient: s.settings.orient === 'landscape' ? 'landscape' : 'portrait' })}<p class="muted">Add a file to see exactly how it will print, in colour or grayscale, with your paper and orientation.</p></div>`;
  const st = s.settings, r = it.state === 'ready' ? parseRange(it.range, it.pages) : { ok: true, pages: [] }, inc = new Set(r.ok ? r.pages : []);
  const pg = clamp(s.page, 1, it.pages), idx = r.ok ? r.pages.indexOf(pg) : -1;
  const dup = st.duplex !== 'single', o = effOrient(it, st);
  const sheetLbl = idx < 0 ? 'Not printed (outside your page range)' : dup ? `Sheet ${Math.floor(idx / 2) + 1}, ${idx % 2 ? 'back' : 'front'}` : `Sheet ${idx + 1}`;
  const thumbs = Math.min(it.pages, 40);
  return `<div class="card-head"><h2 class="card-h">Preview</h2><div class="row wrap">${chip(`${st.paper} ${o}`, '', 'file')}${chip(st.color === 'bw' ? 'Grayscale' : 'Colour', st.color === 'bw' ? '' : 'good')}${dup ? chip('Double-sided', '', 'layers') : ''}</div></div>
  <p class="pv-name"><b>${esc(it.name)}</b></p>
  <div class="pv-stage"><button class="icon-btn" data-act="pv-step" data-d="-1" aria-label="Previous page" ${pg <= 1 ? 'disabled' : ''}>${ic('left')}</button>
    <div class="pv-paper ${o}">${paperHTML(it, pg, st, { skipped: !inc.has(pg) })}</div>
    <button class="icon-btn" data-act="pv-step" data-d="1" aria-label="Next page" ${pg >= it.pages ? 'disabled' : ''}>${ic('right')}</button></div>
  <p class="pv-meta" aria-live="polite"><b>Page ${pg} of ${it.pages}</b><span>${sheetLbl}</span></p>
  <div class="pv-thumbs" role="listbox" aria-label="Pages">${Array.from({ length: thumbs }, (_, i) => { const n = i + 1; return `<button role="option" aria-selected="${n === pg}" class="th ${n === pg ? 'on' : ''}" data-act="pv-page" data-n="${n}" aria-label="Page ${n}${inc.has(n) ? '' : ', skipped'}">${paperHTML(it, n, st, { thumb: true, skipped: !inc.has(n) })}<span>${n}</span></button>`; }).join('')}${it.pages > thumbs ? `<span class="th-more">+${it.pages - thumbs}</span>` : ''}</div>`;
};
REGIONS.studioSettings = () => {
  const s = ui.studio; if (!s) return ''; const u = me(), guest = isGuest();
  const need = s.items.filter(i => !i.fileId && i.state === 'ready').reduce((a, i) => a + i.size, 0);
  let saveNote = 'This is a one-time print. No copy is kept.';
  if (s.save) {
    if (!need) saveNote = s.items.length ? 'Already in My Files.' : 'Files stay in My Files so you can reprint in one tap.';
    else { const free = u.quota - usedBytes(u), plan = planEviction(u, need); saveNote = plan.short <= 0 ? `Adds ${fmtMB(need)} MB. ${fmtMB(free - need)} MB will be free afterwards.` : `Adds ${fmtMB(need)} MB but only ${fmtMB(free)} MB is free. You'll review which old files to remove before printing.`; }
  }
  return `${settingsForm('studio')}
  <div class="opts">
    ${u ? `<div class="set-row"><div><b>Save to My Files</b><small class="${s.save && need && planEviction(u, need).short > 0 ? 'warn-t' : ''}">${esc(saveNote)}</small></div>${sw(s.save, 'st-save', '', 'Save to My Files')}</div>` : ''}
    ${u ? `<div class="set-row"><div><b>WhatsApp me when it's ready</b><small>${u.wa.connected ? `ZeroClaw will message ${esc(u.phone)}.` : 'Connect WhatsApp in Settings first.'}</small></div>${sw(s.notifyWa && u.wa.connected, 'st-wa', u.wa.connected ? '' : 'disabled', 'WhatsApp when ready')}</div>` : ''}
    ${guest ? `<div class="field"><label class="lbl" for="guest-name">Name for collection <span class="muted">(optional)</span></label><input id="guest-name" class="input" data-in="guestname" value="${esc(s.guestName)}" placeholder="So staff can find your print" autocomplete="off"/><small class="muted">Only used on the shelf label. Deleted with the job.</small></div>` : ''}
  </div>`;
};
REGIONS.studioRoute = () => {
  const s = ui.studio; if (!s) return '';
  const route = studioRoute();
  const opt = (id, name, sub, dis, reason, on) => `<button type="button" id="popt-${id}" role="radio" class="popt ${on ? 'on' : ''}" aria-checked="${on}" ${dis ? 'disabled' : ''} data-act="st-printer" data-id="${id}"><span class="popt-ic">${ic('printer')}</span><span class="popt-b"><b>${esc(name)}</b><small>${esc(dis ? reason : sub)}</small></span><span class="radio" aria-hidden="true"></span></button>`;
  const autoSub = route.p ? `${route.p.name} · ${route.eta != null ? fmtEta(route.eta) : 'paused'}` : 'Picks the fastest printer that fits';
  return `<div class="field"><label class="lbl">Printer</label><div class="popts" role="radiogroup" aria-label="Printer">${opt('auto', 'Auto (recommended)', autoSub, false, '', s.printerPref === 'auto')}${S.printers.map(p => { const is = printerIssues(p, s.settings), dis = is.length > 0, w = printerWaitSec(p); return opt(p.id, p.name, `${pStatusLabel(p)}${w != null ? ' · wait ' + fmtEta(w + 0) : ''}`, dis, `Unavailable: ${is[0] || ''}`, s.printerPref === p.id); }).join('')}</div>${!route.p ? `<div class="notice warn" role="alert">${ic('alert')}<div>${esc(route.msg)}</div></div>` : ''}</div>`;
};
REGIONS.studioSummary = () => {
  const s = ui.studio; if (!s) return ''; const t = studioTotals(), r = studioRoute();
  return `<dl class="sum"><div><dt>Files</dt><dd>${t.n}</dd></div><div><dt>Pages</dt><dd>${t.pages}</dd></div><div><dt>Sheets</dt><dd>${t.sheets}</dd></div><div><dt>Est. time</dt><dd>${r.p && t.impressions ? fmtEta(r.eta) : 'n/a'}</dd></div></dl>`;
};
REGIONS.studioBar = () => {
  const s = ui.studio; if (!s) return ''; const t = studioTotals(), issues = studioIssues(), r = studioRoute(), guest = isGuest();
  const ok = !issues.length;
  return `<div class="st-bar ${s.items.length ? 'has' : ''}">
    <div class="st-bar-i"><b>${s.items.length ? `${plural(t.n, 'file')} · ${plural(t.sheets, 'sheet')}` : 'Nothing to print yet'}</b><small class="${ok ? 'muted' : 'warn-t'}">${ok ? (r.p ? `${esc(r.p.name)} · ${fmtEta(r.eta)}` : '') : esc(issues[0])}</small></div>
    <div class="st-bar-a"><button class="btn lg" data-act="${guest ? 'locked-sched' : 'st-schedule'}" ${ok ? '' : 'disabled'}>${ic(guest ? 'lock' : 'calendar')}<span>Schedule</span></button>
    <button class="btn primary lg" id="printNow" data-act="st-print" ${ok ? '' : 'disabled'}>${ic('printer')}<span>Print now</span></button></div></div>`;
};
afterRender.studio = () => { };

/* ---------- interactions ---------- */
const refreshFilesAll = () => refresh('studioFiles', 'studioPreview', 'studioSettings', 'studioRoute', 'studioSummary', 'studioBar');
actions['pick-files'] = () => $('#fileInput').click();
actions['dismiss-errs'] = () => { ui.studio.errors = []; refresh('studioFiles'); };
actions['fi-select'] = el => { ui.studio.sel = el.dataset.uid; ui.studio.page = 1; refresh('studioFiles', 'studioPreview'); };
actions['fi-remove'] = el => { const s = ui.studio, it = s.items.find(i => i.uid === el.dataset.uid); s.items = s.items.filter(i => i !== it); if (s.sel === it.uid) s.sel = null; s.page = 1; if (it.blobUrl && !it.fileId) { try { URL.revokeObjectURL(it.blobUrl); } catch (_) { } } refreshFilesAll(); toast({ kind: 'info', msg: `Removed ${it.name}`, action: { label: 'Undo', fn: () => { s.items.push(it); refreshFilesAll(); } }, ttl: 4500 }); };
actions['fi-move'] = el => { const s = ui.studio, i = s.items.findIndex(x => x.uid === el.dataset.uid), j = i + +el.dataset.d; if (j < 0 || j >= s.items.length) return; [s.items[i], s.items[j]] = [s.items[j], s.items[i]]; refresh('studioFiles'); const b = $(`[data-act="fi-move"][data-uid="${el.dataset.uid}"][data-d="${el.dataset.d}"]`); if (b && !b.disabled) b.focus(); toast({ kind: 'info', msg: `${s.items[j].name} is now number ${j + 1}`, ttl: 1600 }); };
actions['copies'] = el => { const it = ui.studio.items.find(i => i.uid === el.dataset.uid); it.copies = clamp(it.copies + +el.dataset.d, 1, 500); refresh('studioFiles', 'studioSummary', 'studioBar', 'studioRoute'); };
actions['fi-retry'] = el => { const it = ui.studio.items.find(i => i.uid === el.dataset.uid); it.state = 'uploading'; it.progress = 0; simulateUpload(it); refresh('studioFiles'); };
actions['pv-step'] = el => { const it = selItem(); ui.studio.page = clamp(ui.studio.page + +el.dataset.d, 1, it.pages); refresh('studioPreview'); };
actions['pv-page'] = el => { ui.studio.page = +el.dataset.n; refresh('studioPreview'); };
actions['st-printer'] = el => { ui.studio.printerPref = el.dataset.id; refresh('studioRoute', 'studioSummary', 'studioBar'); };
actions['st-save'] = el => { ui.studio.save = !ui.studio.save; refresh('studioSettings'); };
actions['st-wa'] = el => { if (el.disabled) return; ui.studio.notifyWa = !ui.studio.notifyWa; refresh('studioSettings'); };
actions['locked-sched'] = () => lockedSheet('planner');
inputs.range = (el, e) => {
  const it = ui.studio.items.find(i => i.uid === el.dataset.uid); it.range = el.value; const r = parseRange(it.range, it.pages);
  el.classList.toggle('invalid', !r.ok); el.setAttribute('aria-invalid', String(!r.ok));
  const m = $('#rm-' + it.uid); if (m) { m.textContent = r.ok ? '' : r.err; m.classList.toggle('bad-t', !r.ok); }
  refresh('studioPreview', 'studioSummary', 'studioBar', 'studioRoute');
};
inputs.copies = (el, e) => { const it = ui.studio.items.find(i => i.uid === el.dataset.uid); const v = parseInt(el.value, 10); if (!isNaN(v)) it.copies = clamp(v, 1, 500); if (e.type === 'change') { el.value = it.copies; refresh('studioFiles'); } refresh('studioSummary', 'studioBar', 'studioRoute'); };
inputs.guestname = el => { ui.studio.guestName = el.value; };

/* ---------- ingest, upload simulation, page counting ---------- */
async function countPages(it, f) {
  try {
    if (it.kind === 'img') { it.pages = 1; return; }
    if (it.ext === 'pdf') {
      const buf = await f.slice(0, 40 * MB).arrayBuffer(); const txt = new TextDecoder('latin1').decode(new Uint8Array(buf));
      const m = txt.match(/\/Type\s*\/Page(?![s\w])/g); if (m && m.length) { it.pages = m.length; return; }
    }
    it.est = true; it.pages = Math.max(1, Math.round(f.size / ({ docx: 38000, doc: 38000, pptx: 90000, ppt: 90000, xlsx: 60000, xls: 60000, csv: 4000, txt: 3000 }[it.ext] || 60000)));
    it.pages = Math.min(it.pages, 300);
  } catch (e) { it.est = true; it.pages = 1; }
}
function simulateUpload(it) {
  const t = setInterval(() => {
    if (!ui.studio || !ui.studio.items.includes(it)) return clearInterval(t);
    it.progress = Math.min(100, it.progress + rand(9, 22));
    if (it.progress >= 100 && !it.counting) {
      clearInterval(t);
      if (demo.apiMode === 'outage' || (demo.apiMode === 'flaky' && Math.random() < 0.4)) it.state = 'error'; else { it.state = 'ready'; it.progress = 100; if (!ui.studio.sel) ui.studio.sel = it.uid; }
    }
    refresh('studioFiles', 'studioPreview', 'studioSummary', 'studioBar', 'studioRoute');
  }, 110);
}
async function ingest(list) {
  if (!S.session.role) return;
  if (ui.view !== 'studio') { go('studio'); await sleep(50); }
  if (!ui.studio) ui.studio = newStudio();
  for (let i = 0; i < 40 && !$('[data-region="studioFiles"]'); i++) await sleep(100);
  const s = ui.studio;
  const errs = [];
  for (const f of Array.from(list)) {
    const ext = extOf(f.name);
    if (!OK_EXT.includes(ext)) { errs.push(`${f.name}: .${ext || 'unknown'} files can't be printed here. Use PDF, Word, PowerPoint, Excel, image or text files.`); continue; }
    if (f.size > MAX_FILE) { errs.push(`${f.name} is ${fmtSize(f.size)}. Files are limited to 50 MB. Try compressing it or splitting it.`); continue; }
    if (f.size === 0) { errs.push(`${f.name} is empty.`); continue; }
    const it = { uid: uid('i'), fileId: null, name: f.name, ext, kind: EXT_KIND[ext], hue: hueFor(f.name), size: f.size, pages: 1, est: false, blobUrl: EXT_KIND[ext] === 'img' ? URL.createObjectURL(f) : null, range: '', copies: 1, state: 'uploading', progress: 0, counting: true };
    s.items.push(it); countPages(it, f).then(() => { it.counting = false; refresh('studioFiles', 'studioPreview', 'studioSummary', 'studioBar', 'studioRoute'); }); simulateUpload(it);
  }
  s.errors = errs; refreshFilesAll();
  if (errs.length) toast({ kind: 'bad', msg: errs.length === 1 ? errs[0] : `${errs.length} files couldn't be added. See the list.`, ttl: 7000 });
}
actions['add-sample'] = el => {
  const x = SAMPLES[+el.dataset.i], ext = extOf(x.name), s = ui.studio;
  const it = { uid: uid('i'), fileId: null, name: x.name, ext, kind: EXT_KIND[ext], hue: hueFor(x.name), size: x.size, pages: x.pages, est: false, blobUrl: null, range: '', copies: 1, state: 'uploading', progress: 0 };
  s.items.push(it); simulateUpload(it); refreshFilesAll();
};
inputs.fileinput = (el, e) => { if (el.files && el.files.length) ingest(el.files); el.value = ''; };

/* drag to reorder (desktop) */
document.addEventListener('dragstart', e => { const li = e.target.closest && e.target.closest('.fi'); if (!li || !ui.studio) return; ui.studio.dragUid = li.dataset.uid; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', li.dataset.uid); } catch (_) { } });
document.addEventListener('dragover', e => { const li = e.target.closest && e.target.closest('.fi'); if (li && ui.studio && ui.studio.dragUid) { e.preventDefault(); $$('.fi.over').forEach(x => x.classList.remove('over')); li.classList.add('over'); } });
document.addEventListener('drop', e => {
  const li = e.target.closest && e.target.closest('.fi'); if (!li || !ui.studio || !ui.studio.dragUid) return; e.preventDefault(); e.stopPropagation();
  const s = ui.studio, from = s.items.findIndex(i => i.uid === s.dragUid), to = s.items.findIndex(i => i.uid === li.dataset.uid); s.dragUid = null;
  if (from > -1 && to > -1 && from !== to) { const [m] = s.items.splice(from, 1); s.items.splice(to, 0, m); } refresh('studioFiles');
}, true);
document.addEventListener('dragend', () => { if (ui.studio) ui.studio.dragUid = null; $$('.fi.dragging,.fi.over').forEach(x => x.classList.remove('dragging', 'over')); });

/* ---------- pick from My Files (shared with planner) ---------- */
const pk = { sel: new Set(), q: '', cb: null, exclude: new Set(), title: 'Choose from My Files' };
function openFilePicker(cb, exclude = []) { pk.sel = new Set(); pk.q = ''; pk.cb = cb; pk.exclude = new Set(exclude); openOverlay({ id: 'picker', kind: 'sheet', title: 'Choose from My Files', render: pickerRender }); }
function pickerRender() {
  const u = me(), l = userFiles(u.id).filter(f => !pk.exclude.has(f.id) && f.name.toLowerCase().includes(pk.q.toLowerCase())).sort((a, b) => (b.lastPrinted || 0) - (a.lastPrinted || 0) || b.addedAt - a.addedAt);
  return {
    body: `<div class="searchbox">${ic('search')}<input id="pick-q" class="input" type="search" placeholder="Search your files" value="${esc(pk.q)}" data-in="pickq" aria-label="Search your files"/></div>
    ${l.length ? `<ul class="pick-list">${l.map(f => `<li><label class="pick-i ${pk.sel.has(f.id) ? 'on' : ''}"><input type="checkbox" data-in="pickchk" data-id="${f.id}" ${pk.sel.has(f.id) ? 'checked' : ''}/>${fileTile(f)}<span class="pi-b"><b>${esc(f.name)}</b><small>${fileMeta(f)}${f.lastPrinted ? ' · printed ' + ago(f.lastPrinted) : ''}</small></span></label></li>`).join('')}</ul>` : emptyState({ icon: 'folder', title: pk.q ? 'No matching files' : 'No files to add', body: pk.q ? 'Try a different name.' : 'Files you print are saved here automatically.' })}`,
    foot: `<button class="btn ghost" data-act="ov-close" data-id="picker">Cancel</button><button class="btn primary" data-act="pick-done" ${pk.sel.size ? '' : 'disabled'}>${pk.sel.size ? `Add ${plural(pk.sel.size, 'file')}` : 'Select files'}</button>`
  };
}
inputs.pickq = (el) => { pk.q = el.value; refreshOverlay('picker'); };
inputs.pickchk = el => { el.checked ? pk.sel.add(el.dataset.id) : pk.sel.delete(el.dataset.id); refreshOverlay('picker'); };
actions['pick-done'] = () => { const fs = [...pk.sel].map(fileById).filter(Boolean); closeOverlay('picker'); pk.cb && pk.cb(fs); };
actions['studio-pick'] = () => openFilePicker(fs => { const s = ui.studio; fs.forEach(f => s.items.push(itemFromFile(f))); if (!s.sel) s.sel = s.items[0].uid; refreshFilesAll(); }, ui.studio.items.map(i => i.fileId).filter(Boolean));

/* ---------- submit ---------- */
actions['st-print'] = el => submitStudio(null, el);
function spaceSheet(plan, need, scheduled, btn) {
  const u = me(), s = ui.studio, canClean = plan.ok && u.prefs.autoClean;
  openOverlay({
    id: 'space', kind: 'dialog', title: 'Your storage is almost full', render: () => ({
      body: `<div class="notice warn">${ic('alert')}<div>Saving these files needs <b>${fmtMB(need)} MB</b>, but only <b>${fmtMB(u.quota - usedBytes(u))} MB</b> of your ${u.quota / MB} MB is free.</div></div>
      ${canClean ? `<p class="prose">To make room, these <b>${plural(plan.remove.length, 'oldest file')}</b> would be removed (${fmtMB(plan.freed)} MB). Pinned files and files in planned prints are never touched.</p>
        <ul class="evict">${plan.remove.map(f => `<li>${fileTile(f)}<span><b>${esc(f.name)}</b><small>Added ${ago(f.addedAt)} · ${fmtSize(f.size)}</small></span></li>`).join('')}</ul>`
        : plan.ok ? `<p class="prose">Auto-remove is turned off in Settings, so nothing will be deleted for you.</p>` : `<p class="prose">Even after removing every unprotected file, there isn't enough room. Pinned files and files in planned prints are protected: free some space in My Files, or print without saving.</p>`}`,
      foot: `<button class="btn ghost" data-act="go-files-close">Manage files</button>${scheduled ? '' : `<button class="btn" data-act="space-nosave">Print without saving</button>`}${canClean ? `<button class="btn primary" data-act="space-clean">Remove ${plural(plan.remove.length, 'file')} and ${scheduled ? 'schedule' : 'print'}</button>` : ''}`
    })
  });
  actions['space-clean'] = () => { closeOverlay('space'); doSubmit({ scheduled, save: true, plan, btn }); };
  actions['space-nosave'] = () => { closeOverlay('space'); s.save = false; refresh('studioSettings'); doSubmit({ scheduled, save: false, btn }); };
  actions['go-files-close'] = () => { closeOverlay('space'); go('files'); };
}
function submitStudio(scheduled, btn, remOverride) {
  const s = ui.studio, u = me(); if (studioIssues().length) return;
  if (scheduled && !u) return lockedSheet('planner');
  const save = scheduled ? true : (u ? s.save : false);
  if (u && save) {
    const need = s.items.filter(i => !i.fileId && i.state === 'ready').reduce((a, i) => a + i.size, 0);
    if (need > 0) { const plan = planEviction(u, need); if (plan.short > 0) { spaceSheet(plan, need, scheduled, btn); s._rem = remOverride; return; } }
  }
  s._rem = remOverride; doSubmit({ scheduled, save, btn });
}
function doSubmit({ scheduled, save, plan, btn }) {
  const s = ui.studio, u = me(), guest = isGuest(), items = studioReady();
  run(scheduled ? 'Scheduling' : 'Sending to printer', () => {
    if (plan && u) autoClean(u, plan);
    if (u && save) items.forEach(i => { if (!i.fileId) storeItem(u, i); });
    const job = createJob({ owner: u ? u.id : null, guest: guest ? { id: S.session.guestId, name: s.guestName.trim() || 'Guest' } : null, items, settings: s.settings, scheduled, printerPref: s.printerPref, save, rem: s._rem || (u ? u.prefs.defRem : undefined), notifyWa: !!(u && u.wa.connected && s.notifyWa), source: guest ? 'guest' : 'web' });
    if (u) { u.prefs.last = { ...s.settings }; items.forEach(i => { const f = fileById(i.fileId); if (f) f.lastPrinted = S.now; }); }
    audit(guest ? 'guest.print' : scheduled ? 'planner.create' : 'job.create', job.order, { detail: `${plural(items.length, 'file')}, ${job.sheets} sheets${guest ? '. Not saved' : scheduled ? '. ' + fmtWhen(scheduled) : save ? '. Saved' : '. Not saved'}` });
    if (guest) items.forEach(i => { if (i.blobUrl) try { URL.revokeObjectURL(i.blobUrl); } catch (_) { } });
    return job;
  }, {
    btn, onOk: job => {
      ui.studio = newStudio();
      if (scheduled) { closeOverlay('sched'); toast({ kind: 'good', msg: `Scheduled for ${fmtWhen(scheduled)}`, action: { label: 'View planner', fn: () => go('planner') } }); go('planner'); }
      else { renderMain(false); sentSheet(job); }
      onSimChange();
    }
  });
}
function sentSheet(job) {
  openOverlay({
    id: 'sent', kind: 'dialog', title: 'Sent to the printer', render: () => {
      const p = printerById(job.printer), eta = jobEtaSec(job), pos = queuePos(job);
      return {
        body: `<div class="sent"><div class="sent-ok">${ic('check')}</div><p class="muted">Your print order</p><div class="order-id" aria-label="Order ID ${job.order}">${job.order}</div>
        <dl class="sum"><div><dt>Printer</dt><dd>${p ? esc(p.name) : 'Waiting'}</dd></div><div><dt>${job.status === 'Printing' ? 'Status' : 'Position'}</dt><dd>${job.status === 'Printing' ? 'Printing' : pos ? '#' + pos : 'n/a'}</dd></div><div><dt>Ready in</dt><dd>${eta != null ? fmtEta(eta) : 'n/a'}</dd></div></dl>
        <div class="pickup"><span>Pickup code</span><b>${job.code}</b></div>
        ${isGuest() ? `<div class="notice info">${ic('info')}<div>Write this down. Guests have no history, so this order ID and code are the only way to find your print.</div></div>` : job.notifyWa ? `<p class="muted sm center">${ic('chat')} We'll WhatsApp you when it's ready.</p>` : ''}</div>`,
        foot: `<button class="btn ghost" data-act="ov-close" data-id="sent">Print another</button><button class="btn primary" data-act="sent-track" data-id="${job.id}">${ic('queue')}Track in Live Queue</button>`
      };
    }
  });
}
actions['sent-track'] = el => { closeOverlay('sent'); ui.openJob = el.dataset.id; go('queue'); };

/* ---------- schedule sheet ---------- */
const sch = { date: '', time: '', rem: { 0: true, 1: false, 2: false } };
function nextOpen(from) { let d = from; while (labClosed(d)) d += DAY; return d; }
actions['st-schedule'] = el => {
  const u = me(); const tm = nextOpen(S.now + DAY); sch.date = dayKey(tm); sch.time = '09:00'; sch.rem = { ...u.prefs.defRem };
  openOverlay({ id: 'sched', kind: 'sheet', title: 'Schedule this print', sub: 'It joins the queue at the time you pick.', render: schedRender });
};
function schedTs() { return sch.date ? fromInputs(sch.date, sch.time || '09:00') : NaN; }
function schedRender() {
  const u = me(), ts = schedTs(), valid = ts > S.now + 2 * MIN, closed = !isNaN(ts) && labClosed(ts), off = [0, 1, 2].filter(o => sch.rem[o]);
  const q = (l, t) => `<button class="chip btnchip ${schedTs() === t ? 'on' : ''}" data-act="sch-quick" data-t="${t}">${l}</button>`;
  const tom = nextOpen(atTime(S.now + DAY, '09:00')), eve = atTime(S.now, '18:30');
  const tmp = { owner: u.id, scheduled: ts, rem: sch.rem, remSent: {} };
  return {
    body: `<div class="row wrap">${eve > S.now + 5 * MIN ? q('Today 6:30 PM', eve) : ''}${q(`${relDay(tom)} 9:00 AM`, tom)}${q('Next Saturday 10:00 AM', (() => { let d = S.now + DAY; while (dow(d) !== 6) d += DAY; return atTime(d, '10:00'); })())}</div>
    <div class="grid2"><div class="field"><label class="lbl" for="sch-date">Date</label><input id="sch-date" class="input" type="date" min="${dayKey(S.now)}" value="${sch.date}" data-in="schdate"/></div>
    <div class="field"><label class="lbl" for="sch-time">Time</label><input id="sch-time" class="input" type="time" value="${sch.time}" data-in="schtime"/></div></div>
    ${!isNaN(ts) && !valid ? `<div class="notice bad" role="alert">${ic('alert')}<div>Pick a time in the future. It's ${fmtTime(S.now)} now.</div></div>` : ''}
    ${closed ? `<div class="notice warn">${ic('alert')}<div>The lab is closed on Fridays. It will print, but you can collect it from Saturday.</div></div>` : ''}
    <div class="field"><label class="lbl">WhatsApp reminders (ZeroClaw)</label>${u.wa.connected ? remChips2(sch.rem, 'sch') : `<div class="notice info">${ic('info')}<div>WhatsApp isn't connected. <button class="link" data-act="open-settings">Connect it in Settings</button> to get reminders.</div></div>`}
    ${u.wa.connected && valid ? `<p class="muted sm">${off.length ? 'We will message ' + esc(u.phone) + ': ' + off.map(o => reminderLabel(tmp, o, u)).join('; ') + '.' : 'No reminders for this task.'}</p>` : ''}</div>
    <p class="muted sm">${ic('info')} Scheduled files stay in My Files until printed, and are protected from auto-removal.</p>`,
    foot: `<button class="btn ghost" data-act="ov-close" data-id="sched">Cancel</button><button class="btn primary" data-act="sch-go" ${valid ? '' : 'disabled'}>${ic('calendar')}Schedule print</button>`
  };
}
function reminderLabel(job, off, u) { const t = reminderTime(job, off, u); return t <= S.now ? `${['on the day', '1 day before', '2 days before'][off]} (time already passed, skipped)` : `${fmtDate(t)} ${fmtTime(t)}`; }
function remChips2(rem, scope) { return `<div class="row wrap rem-chips" role="group" aria-label="Reminder timing">${[[0, 'On the day'], [1, '1 day before'], [2, '2 days before']].map(([o, l]) => `<button type="button" class="chip tog ${rem[o] ? 'on' : ''}" aria-pressed="${!!rem[o]}" data-act="rem2" data-scope="${scope}" data-o="${o}">${rem[o] ? ic('check') : ''}${l}</button>`).join('')}</div>`; }
actions['rem2'] = el => { const o = +el.dataset.o; if (el.dataset.scope === 'sch') { sch.rem[o] = !sch.rem[o]; refreshOverlay('sched'); } else { ui.taskEdit.rem[o] = !ui.taskEdit.rem[o]; refreshOverlay('task'); } };
inputs.schdate = (el, e) => { sch.date = el.value; refreshOverlay('sched'); };
inputs.schtime = (el, e) => { sch.time = el.value; if (e.type === 'change') refreshOverlay('sched'); };
actions['sch-quick'] = el => { const t = +el.dataset.t; sch.date = dayKey(t); sch.time = timeInput(t); refreshOverlay('sched'); };
actions['sch-go'] = el => submitStudio(schedTs(), el, { ...sch.rem });
