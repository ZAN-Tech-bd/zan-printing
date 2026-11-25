/* =====================================================================
   07 My Files
   ===================================================================== */
const TYPE_FILTERS = [['all', 'All'], ['doc', 'Documents'], ['img', 'Images'], ['sheet', 'Sheets'], ['slides', 'Slides'], ['pinned', 'Pinned']];
VIEW_RENDER.files = () => {
  return `${pageHead('My Files', 'Saved automatically when you print. Reprint in one tap.', `<button class="btn primary" data-act="go" data-v="studio">${ic('upload')}Add files</button>`)}
  <section class="card" aria-label="Storage">${reg('filesStorage')}</section>
  <div class="files-bar" data-region="filesBar">${REGIONS.filesBar()}</div>
  <div data-region="filesList">${REGIONS.filesList()}</div>`;
};
function fileFlags(u) {
  const prot = protectedIds(u.id), planned = new Set();
  S.jobs.forEach(j => { if (j.owner === u.id && ['Scheduled', 'Queued', 'Printing'].includes(j.status)) j.items.forEach(i => i.fileId && planned.add(i.fileId)); });
  const next = eligibleFiles(u); return { prot, planned, next };
}
REGIONS.filesStorage = () => {
  const u = me(), used = usedBytes(u), p = pct(used, u.quota), free = u.quota - used, fl = fileFlags(u), lvl = p >= 95 ? 'bad' : p >= 80 ? 'warn' : 'ok';
  const names = fl.next.slice(0, 2).map(f => esc(f.name));
  const banner = lvl === 'ok' ? '' : `<div class="notice ${lvl === 'bad' ? 'bad' : 'warn'}" role="${lvl === 'bad' ? 'alert' : 'status'}">${ic('alert')}<div><b>${lvl === 'bad' ? 'Almost full' : 'Getting full'}: ${p}% used.</b> ${u.prefs.autoClean ? (names.length ? `When a new file doesn't fit, the oldest unprotected files go first, starting with ${names.join(' and ')}. You'll see a warning before anything is removed.` : 'Every file is pinned or in a planned print, so nothing can be removed automatically. Delete or unpin something to make room.') : 'Auto-remove is off, so new files that do not fit will not be saved.'}</div></div>`;
  const by = { doc: 0, sheet: 0, img: 0, slides: 0 }; userFiles(u.id).forEach(f => by[f.kind] += f.size);
  const lg = [['doc', 'Documents'], ['slides', 'Slides'], ['sheet', 'Sheets'], ['img', 'Images']].filter(([k]) => by[k] > 0).map(([k, l]) => `<li><i class="k-${k}"></i>${l}<b>${fmtMB(by[k])} MB</b></li>`).join('');
  return `<div class="storage"><div class="st-nums"><div class="big-n"><b>${fmtMB(used)}</b><span>of ${u.quota / MB} MB</span></div><p class="${lvl === 'ok' ? 'muted' : lvl + '-t'}">${fmtMB(Math.max(0, free))} MB free · ${p}% used</p></div>${storageBar(u)}
  <ul class="legend">${lg}${u.usedStatic ? `<li><i class="k-other"></i>Other<b>${fmtMB(u.usedStatic)} MB</b></li>` : ''}</ul></div>${banner}
  <details class="evict-d" ${lvl === 'bad' ? 'open' : ''}><summary>Auto-remove order <small class="muted">(oldest first, skips pinned and planned)</small></summary>${fl.next.length ? `<ol class="evict">${fl.next.slice(0, 4).map(f => `<li>${fileTile(f)}<span><b>${esc(f.name)}</b><small>Added ${ago(f.addedAt)} · ${fmtSize(f.size)}</small></span></li>`).join('')}</ol>` : '<p class="muted sm">Nothing is eligible right now.</p>'}</details>
  <div class="set inline"><div class="set-row"><div><b>Save files by default</b><small>New prints are kept here unless you switch it off per print.</small></div>${sw(u.prefs.save, 'pref-toggle2', 'data-k="save"', 'Save files by default')}</div>
  <div class="set-row"><div><b>Remove oldest files when full</b><small>Always with a warning first.</small></div>${sw(u.prefs.autoClean, 'pref-toggle2', 'data-k="autoClean"', 'Remove oldest files when full')}</div></div>`;
};
actions['pref-toggle2'] = el => { const p = me().prefs; p[el.dataset.k] = !p[el.dataset.k]; refresh('filesStorage'); };
REGIONS.filesBar = () => {
  const n = ui.filesSel.size;
  if (ui.selectMode) return `<div class="bulk"><b>${n ? plural(n, 'file') + ' selected' : 'Select files'}</b><div class="row"><button class="btn sm" data-act="bulk-print" ${n ? '' : 'disabled'}>${ic('printer')}Print</button><button class="btn sm danger" data-act="bulk-delete" ${n ? '' : 'disabled'}>${ic('trash')}Delete</button><button class="btn sm ghost" data-act="select-mode">Done</button></div></div>`;
  return `<div class="searchbox">${ic('search')}<input id="files-q" class="input" type="search" placeholder="Search by file name" value="${esc(ui.filesQ)}" data-in="filesq" aria-label="Search files"/></div>
  <div class="chips-scroll" role="group" aria-label="Filter by type">${TYPE_FILTERS.map(([v, l]) => `<button class="chip btnchip ${ui.filesType === v ? 'on' : ''}" aria-pressed="${ui.filesType === v}" data-act="files-type" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="row"><label class="sel-wrap"><span class="sr">Sort</span><select id="files-sort" class="input sm" data-in="filessort" aria-label="Sort files">${[['new', 'Newest'], ['old', 'Oldest'], ['used', 'Recently printed'], ['name', 'Name'], ['size', 'Largest']].map(([v, l]) => `<option value="${v}" ${ui.filesSort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <div class="seg sm" role="group" aria-label="Layout"><button class="${ui.filesLayout === 'grid' ? 'on' : ''}" aria-pressed="${ui.filesLayout === 'grid'}" data-act="files-layout" data-v="grid" aria-label="Grid view">${ic('grid')}</button><button class="${ui.filesLayout === 'list' ? 'on' : ''}" aria-pressed="${ui.filesLayout === 'list'}" data-act="files-layout" data-v="list" aria-label="List view">${ic('list')}</button></div>
  <button class="btn sm ghost" data-act="select-mode">${ic('check')}Select</button></div>`;
};
function filteredFiles() {
  const u = me(), q = ui.filesQ.trim().toLowerCase(); let l = userFiles(u.id).filter(f => (!q || f.name.toLowerCase().includes(q)) && (ui.filesType === 'all' || (ui.filesType === 'pinned' ? f.pinned : f.kind === ui.filesType)));
  const cmp = { new: (a, b) => b.addedAt - a.addedAt, old: (a, b) => a.addedAt - b.addedAt, used: (a, b) => (b.lastPrinted || 0) - (a.lastPrinted || 0), name: (a, b) => a.name.localeCompare(b.name), size: (a, b) => b.size - a.size }[ui.filesSort];
  return l.sort(cmp);
}
REGIONS.filesList = () => {
  const u = me(), all = userFiles(u.id);
  if (!all.length) return emptyState({ icon: 'folder', title: 'No saved files yet', body: 'Anything you print is saved here automatically (you can turn that off). You get 100 MB, with a warning before space runs out.', cta: `<button class="btn primary" data-act="go" data-v="studio">${ic('printer')}Open Print Studio</button>` });
  const l = filteredFiles(); if (!l.length) return emptyState({ icon: 'search', title: 'No files match', body: ui.filesQ ? `Nothing matches "${esc(ui.filesQ)}".` : 'No files of this type.', cta: `<button class="btn" data-act="files-clear">Clear filters</button>` });
  const fl = fileFlags(u), nextIds = new Set(fl.next.slice(0, 2).map(f => f.id));
  return `<ul class="files ${ui.filesLayout}" aria-label="${plural(l.length, 'file')}">${l.map(f => {
    const sel = ui.filesSel.has(f.id), badges = [f.pinned ? chip('Pinned', 'accent', 'pin') : '', fl.planned.has(f.id) ? chip('In planner', 'info', 'calendar') : '', nextIds.has(f.id) && ui.filesLayout === 'grid' ? chip('Removed first', 'warn', 'clock') : ''].join('');
    return `<li class="file ${sel ? 'sel' : ''}">${ui.selectMode ? `<label class="file-chk"><input type="checkbox" data-in="filechk" data-id="${f.id}" ${sel ? 'checked' : ''} aria-label="Select ${esc(f.name)}"/></label>` : ''}
      <button class="file-thumb" data-act="${ui.selectMode ? 'file-sel' : 'file-preview'}" data-id="${f.id}" aria-label="${ui.selectMode ? 'Select' : 'Preview'} ${esc(f.name)}">${paperHTML(f, 1, { paper: 'A4', color: 'color', orient: 'auto' }, { thumb: true })}${fileTile(f, 'over')}</button>
      <div class="file-b"><b class="file-name" title="${esc(f.name)}">${esc(f.name)}</b><small>${fileMeta(f)}</small><small class="muted">${f.lastPrinted ? 'Printed ' + ago(f.lastPrinted) : 'Never printed'} · added ${ago(f.addedAt)}</small>${badges ? `<div class="row wrap">${badges}</div>` : ''}</div>
      ${ui.selectMode ? '' : `<div class="file-a"><button class="btn sm primary" data-act="file-reprint" data-id="${f.id}">${ic('printer')}Reprint</button><button class="icon-btn sm" data-act="file-menu" data-id="${f.id}" aria-label="More actions for ${esc(f.name)}" aria-haspopup="menu">${ic('more')}</button></div>`}</li>`;
  }).join('')}</ul>`;
};
inputs.filesq = el => { ui.filesQ = el.value; refresh('filesList'); };
inputs.filessort = el => { ui.filesSort = el.value; refresh('filesList'); };
inputs.filechk = el => { el.checked ? ui.filesSel.add(el.dataset.id) : ui.filesSel.delete(el.dataset.id); refresh('filesBar', 'filesList'); };
actions['files-type'] = el => { ui.filesType = el.dataset.v; refresh('filesBar', 'filesList'); };
actions['files-layout'] = el => { ui.filesLayout = el.dataset.v; refresh('filesBar', 'filesList'); };
actions['files-clear'] = () => { ui.filesQ = ''; ui.filesType = 'all'; refresh('filesBar', 'filesList'); };
actions['select-mode'] = () => { ui.selectMode = !ui.selectMode; ui.filesSel.clear(); refresh('filesBar', 'filesList'); };
actions['file-sel'] = el => { const id = el.dataset.id; ui.filesSel.has(id) ? ui.filesSel.delete(id) : ui.filesSel.add(id); refresh('filesBar', 'filesList'); };
actions['bulk-print'] = () => { const fs = [...ui.filesSel].map(fileById).filter(Boolean); ui.selectMode = false; ui.filesSel.clear(); prefillStudio(fs.map(itemFromFile)); };
actions['bulk-delete'] = () => {
  const fs = [...ui.filesSel].map(fileById).filter(Boolean), pr = protectedIds(me().id), blocked = fs.filter(f => pr.has(f.id)), free = fs.filter(f => !pr.has(f.id));
  confirmDialog({ title: `Delete ${plural(free.length, 'file')}?`, danger: true, confirm: `Delete ${free.length}`, body: `<p>This frees ${fmtMB(free.reduce((a, f) => a + f.size, 0))} MB.</p>${blocked.length ? `<p class="muted">${plural(blocked.length, 'file')} (${blocked.map(f => esc(f.name)).join(', ')}) will be kept because ${blocked.length === 1 ? 'it is' : 'they are'} pinned or in a planned print.</p>` : ''}`, onConfirm: () => run('Delete files', () => { free.forEach(f => removeFile(f)); }, { onOk: () => { ui.filesSel.clear(); ui.selectMode = false; refresh('filesStorage', 'filesBar', 'filesList', 'sideFoot'); toast({ kind: 'good', msg: `Deleted ${plural(free.length, 'file')}.` }); } }) });
};
actions['file-menu'] = el => {
  const f = fileById(el.dataset.id);
  openMenu(el, [{ label: 'Preview', icon: 'eye', act: 'file-preview', data: { id: f.id } }, { label: f.pinned ? 'Unpin' : 'Pin (never auto-remove)', icon: 'pin', act: 'file-pin', data: { id: f.id } }, { label: 'Schedule a print', icon: 'calendar', act: 'file-schedule', data: { id: f.id } }, { sep: 1 }, { label: 'Delete', icon: 'trash', act: 'file-delete', data: { id: f.id }, danger: true }]);
};
actions['file-pin'] = el => { const f = fileById(el.dataset.id); f.pinned = !f.pinned; audit('file.pin', f.name, { detail: f.pinned ? 'Pinned' : 'Unpinned' }); refresh('filesStorage', 'filesList'); refreshOverlay('fprev'); toast({ kind: 'good', msg: f.pinned ? `Pinned ${f.name}. It won't be removed automatically.` : `Unpinned ${f.name}.`, ttl: 3000 }); };
actions['file-delete'] = el => {
  const f = fileById(el.dataset.id), u = me(), planned = S.jobs.find(j => j.owner === u.id && ['Scheduled', 'Queued', 'Printing'].includes(j.status) && j.items.some(i => i.fileId === f.id));
  if (planned) return confirmDialog({ title: "This file is in a planned print", body: `<p><b>${esc(f.name)}</b> is part of <code>${planned.order}</code> (${planned.status.toLowerCase()}). Cancel or finish that task first, then delete the file.</p>`, confirm: 'Open planner', cancel: 'Close', onConfirm: () => go('planner') });
  const del = () => run('Delete file', () => { removeFile(f); }, { ms: 260, onOk: () => { closeOverlay('fprev'); refresh('filesStorage', 'filesList', 'sideFoot'); toast({ kind: 'info', msg: `Deleted ${f.name}`, action: { label: 'Undo', fn: () => run('Restore file', () => { S.files.push(f); audit('file.restore', f.name); }, { ms: 200, onOk: () => refresh('filesStorage', 'filesList', 'sideFoot') }) }, ttl: 6000 }); } });
  if (f.pinned) confirmDialog({ title: 'Delete a pinned file?', danger: true, confirm: 'Delete', body: `<p><b>${esc(f.name)}</b> is pinned. You can still bring it back with Undo right after.</p>`, onConfirm: del }); else del();
};
actions['file-schedule'] = el => { const f = fileById(el.dataset.id); closeOverlay('fprev'); openTaskEditor(null, [f]); };
actions['file-reprint'] = el => prefillStudio([itemFromFile(fileById(el.dataset.id))]);
function prefillStudio(items) { ui.studio = newStudio(); ui.studio.items = items; ui.studio.sel = items[0] && items[0].uid; go('studio'); }
actions['file-preview'] = el => {
  const id = el.dataset.id; ui.fprev = { id, page: 1 };
  openOverlay({
    id: 'fprev', kind: 'sheet', wide: true, title: fileById(id).name, render: () => {
      const f = fileById(ui.fprev.id); if (!f) return { body: emptyState({ icon: 'file', title: 'File removed', body: 'This file is no longer in My Files.' }) };
      const pg = clamp(ui.fprev.page, 1, f.pages), st = { paper: 'A4', color: 'color', orient: 'auto' };
      return {
        body: `<div class="fprev"><div><div class="pv-stage"><button class="icon-btn" data-act="fp-step" data-d="-1" aria-label="Previous page" ${pg <= 1 ? 'disabled' : ''}>${ic('left')}</button><div class="pv-paper ${effOrient(f, st)}">${paperHTML(f, pg, st)}</div><button class="icon-btn" data-act="fp-step" data-d="1" aria-label="Next page" ${pg >= f.pages ? 'disabled' : ''}>${ic('right')}</button></div><p class="pv-meta"><b>Page ${pg} of ${f.pages}</b></p></div>
        <dl class="kv"><div><dt>Type</dt><dd>${f.ext.toUpperCase()} · ${KIND_LABEL[f.kind]}</dd></div><div><dt>Pages</dt><dd>${f.pages}${f.est ? ' (estimated)' : ''}</dd></div><div><dt>Size</dt><dd>${fmtSize(f.size)}</dd></div><div><dt>Added</dt><dd>${fmtDate(f.addedAt)} (${ago(f.addedAt)})</dd></div><div><dt>Last printed</dt><dd>${f.lastPrinted ? ago(f.lastPrinted) : 'Never'}</dd></div><div><dt>Protection</dt><dd>${f.pinned ? 'Pinned' : protectedIds(me().id).has(f.id) ? 'In a planned print' : 'Can be auto-removed when full'}</dd></div></dl></div>`,
        foot: `<button class="btn danger ghost" data-act="file-delete" data-id="${f.id}">${ic('trash')}Delete</button><button class="btn" data-act="file-pin" data-id="${f.id}">${ic('pin')}${f.pinned ? 'Unpin' : 'Pin'}</button><button class="btn primary" data-act="fp-reprint" data-id="${f.id}">${ic('printer')}Reprint</button>`
      };
    }
  });
};
actions['fp-step'] = el => { ui.fprev.page += +el.dataset.d; refreshOverlay('fprev'); };
actions['fp-reprint'] = el => { closeOverlay('fprev', true); prefillStudio([itemFromFile(fileById(el.dataset.id))]); };

/* ---------- reprint from history ---------- */
function jobFilesStill(j) { return j.items.map(i => ({ i, f: i.fileId && fileById(i.fileId) })); }
function reprintJobToStudio(j) {
  const pairs = jobFilesStill(j), ok = pairs.filter(p => p.f);
  if (!ok.length) return toast({ kind: 'warn', msg: 'The original files were removed from My Files, so this job can\'t be reprinted. Upload them again in Print Studio.', ttl: 7000 });
  const items = ok.map(({ i, f }) => ({ ...itemFromFile(f), range: i.range, copies: i.copies }));
  ui.studio = newStudio(); ui.studio.items = items; ui.studio.sel = items[0].uid; ui.studio.settings = { ...j.settings }; ui.studio.printerPref = 'auto';
  if (ok.length < pairs.length) toast({ kind: 'warn', msg: `${pairs.length - ok.length} file(s) are no longer stored and were left out.` });
  go('studio');
}
function quickReprint(j, btn) {
  const pairs = jobFilesStill(j).filter(p => p.f), u = me();
  if (!pairs.length) return toast({ kind: 'warn', msg: 'The original files were removed from My Files. Upload them again in Print Studio.', ttl: 6000 });
  let made = null;
  run('Reprint', () => {
    made = createJob({ owner: u.id, items: pairs.map(({ i, f }) => ({ ...i, fileId: f.id })), settings: { ...j.settings }, rem: undefined, notifyWa: j.notifyWa && u.wa.connected, source: 'web' });
    pairs.forEach(p => p.f.lastPrinted = S.now); audit('job.reprint', made.order, { detail: `Reprint of ${j.order}` }); return made;
  }, { btn, onOk: job => { onSimChange(); toast({ kind: 'good', msg: `Reprinting as ${job.order}`, action: { label: 'Undo', fn: () => { opCancel(job); onSimChange(); toast({ kind: 'info', msg: `${job.order} cancelled.` }); } }, ttl: 6500 }); } });
}
actions['job-reprint'] = el => reprintJobToStudio(jobById(el.dataset.id));
actions['job-quick'] = el => quickReprint(jobById(el.dataset.id), el);
