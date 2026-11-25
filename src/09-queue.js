/* =====================================================================
   09 Live Queue + job detail
   ===================================================================== */
const Q_FILTERS = [['active', 'Active'], ['Queued', 'Queued'], ['Printing', 'Printing'], ['Ready for Collection', 'Ready'], ['Scheduled', 'Scheduled'], ['Failed', 'Failed'], ['Collected', 'Collected'], ['Cancelled', 'Cancelled'], ['all', 'All']];
function visibleJobs() {
  return S.jobs.filter(j => isAdmin() || isMine(j) || (j.status !== 'Scheduled' && (S.now - (j.events[j.events.length - 1].t)) < DAY));
}
function jobSort(a, b) {
  const rank = { 'Printing': 0, 'Queued': 1, 'Ready for Collection': 2, 'Scheduled': 3, 'Failed': 4, 'Collected': 5, 'Cancelled': 6 };
  if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
  if (a.status === 'Queued') return a.qkey - b.qkey;
  if (a.status === 'Scheduled') return a.scheduled - b.scheduled;
  return (b.events[b.events.length - 1].t) - (a.events[a.events.length - 1].t);
}
VIEW_RENDER.queue = () => `${pageHead('Live Queue', isGuest() ? 'Your print and the lab queue, live.' : 'Where your print is, and how long to wait.')}
  <section class="q-sec" aria-label="Printers"><h2 class="sr">Printers</h2>${reg('qPrinters', 'class="pcards"')}</section>
  ${reg('qMine')}
  <section class="q-sec"><div class="row between wrap"><h2 class="sec-h">Queue</h2></div>${reg('qFilters')}${reg('qList')}</section>`;
afterRender.queue = () => { if (ui.openJob) { const id = ui.openJob; ui.openJob = null; if (jobById(id)) openJobSheet(id); } };
function printerCard(p) {
  const busyJob = S.jobs.find(j => j.status === 'Printing' && j.printer === p.id), waiting = S.jobs.filter(j => j.status === 'Queued' && j.printer === p.id).length;
  const w = printerWaitSec(p), lowInk = Math.min(...Object.values(p.ink)), st = p.status !== 'online' ? p.status : busyJob ? 'printing' : 'ready';
  const label = { printing: 'Printing', ready: 'Ready', paused: 'Paused', jam: 'Paper jam', offline: 'Offline' }[st];
  const free = p.status !== 'online' ? ({ paused: 'Paused by staff', jam: 'Needs attention', offline: 'Offline' }[p.status]) : w < 20 && !busyJob ? 'Free now' : `Free in ${fmtEta(w)}`;
  const caps = [p.caps.color ? 'Colour' : 'B/W', ...p.caps.paper.filter(x => x === 'A3').map(() => 'A3'), p.caps.duplex ? 'Duplex' : ''].filter(Boolean);
  return `<article class="pcard st-${st}" aria-label="${esc(p.name)}, ${label}"><header><div><b>${esc(p.name)}</b><small>${esc(p.loc)}</small></div><span class="pstat ${st}"><i></i>${label}</span></header>
    <div class="p-free ${st === 'jam' || st === 'offline' ? 'bad-t' : st === 'paused' ? 'warn-t' : ''}">${free}</div>
    <p class="muted sm">${waiting ? plural(waiting, 'job') + ' waiting' : 'No one waiting'} · ${caps.join(' · ')}</p>
    ${busyJob ? `<div class="p-now"><div class="row between"><small>${isMine(busyJob) || isAdmin() ? esc(busyJob.order) : 'Job ' + esc(busyJob.order)}${isMine(busyJob) ? ' (yours)' : ''}</small><small>${pct(busyJob.done, busyJob.impressions)}%</small></div>${bar(pct(busyJob.done, busyJob.impressions), 'live', `Printing ${busyJob.order}`)}</div>` : ''}
    <div class="p-meters"><span title="Paper level" class="${p.paper < 15 ? 'warn-t' : ''}">${ic('file')}Paper ${Math.round(p.paper)}%</span><span title="Lowest ink or toner" class="${lowInk < 15 ? 'warn-t' : ''}">${ic('droplet')}${p.caps.color ? 'Ink' : 'Toner'} ${Math.round(lowInk)}%</span></div></article>`;
}
REGIONS.qPrinters = () => S.printers.map(printerCard).join('');
REGIONS.qMine = () => {
  const mine = S.jobs.filter(j => isMine(j) && ['Queued', 'Printing', 'Ready for Collection', 'Failed'].includes(j.status) && (j.status !== 'Failed' || S.now - j.fail.at < 2 * DAY)).sort(jobSort);
  if (!mine.length) return '';
  return `<section class="q-sec"><h2 class="sec-h">${isGuest() ? 'Your prints this session' : 'Your prints'}</h2><div class="mine-grid">${mine.map(mineCard).join('')}</div></section>`;
};
function mineCard(j) {
  const p = printerById(j.printer), prog = pct(j.done, j.impressions), eta = jobEtaSec(j);
  const head = `<div class="row between"><div><b class="mine-t">${esc(jobTitle(j))}</b><div class="job-meta"><code>${j.order}</code><span>${plural(j.sheets, 'sheet')}</span>${p ? `<span>${esc(p.name)}</span>` : ''}</div></div>${pill(j.status)}</div>`;
  let body = '';
  if (j.status === 'Queued') body = `<div class="mine-big"><div><b>#${queuePos(j) || '–'}</b><small>in line</small></div><div><b>${eta != null ? fmtEta(eta).replace('~', '') : 'Waiting'}</b><small>${eta != null ? 'until ready' : (p ? p.name + ' is ' + pStatusLabel(p).toLowerCase() : 'for a printer')}</small></div></div>`;
  if (j.status === 'Printing') body = `<div class="mine-prog">${bar(prog, 'live lg', `Printing ${prog}%`)}<div class="row between"><span>${Math.floor(j.done)} of ${j.impressions} pages</span><b>${prog}%</b></div><small class="muted">${eta != null ? fmtEta(eta) + ' left' : ''}</small></div>`;
  if (j.status === 'Ready for Collection') body = `<div class="ready-box"><div><small>Shelf</small><b>${j.shelf}</b></div><div><small>Pickup code</small><b class="code">${j.code}</b></div><div><small>Ready</small><b>${ago(j.readyAt)}</b></div></div><div class="row wrap"><button class="btn primary" data-act="job-collect" data-id="${j.id}">${ic('check')}I've collected it</button></div>`;
  if (j.status === 'Failed') body = `<div class="notice bad">${ic('alert')}<div><b>${esc(j.fail.reason)}</b><br><small>${j.done >= 1 ? `${Math.floor(j.done)} of ${j.impressions} pages printed before it stopped.` : 'Nothing was printed.'}</small></div></div><div class="row wrap"><button class="btn primary" data-act="job-retry" data-id="${j.id}">${ic('refresh')}Retry${j.done >= 1 ? ' from page ' + (Math.floor(j.done) + 1) : ''}</button></div>`;
  const canCancel = j.status === 'Queued';
  return `<article class="card mine s-${STATUS_META[j.status].cls}" tabindex="-1">${head}${body}<div class="row wrap mine-act"><button class="btn sm ghost" data-act="job-open" data-id="${j.id}">${ic('eye')}Details</button>${canCancel ? `<button class="btn sm ghost danger" data-act="job-cancel" data-id="${j.id}">${ic('ban')}Cancel</button>` : ''}</div></article>`;
}
REGIONS.qFilters = () => {
  const vis = visibleJobs(), cnt = f => f === 'all' ? vis.length : f === 'active' ? vis.filter(j => ['Queued', 'Printing', 'Ready for Collection'].includes(j.status)).length : vis.filter(j => j.status === f).length;
  return `<div class="chips-scroll" role="group" aria-label="Filter by status">${Q_FILTERS.filter(([f]) => f !== 'Scheduled' || !isGuest()).map(([f, l]) => `<button class="chip btnchip ${ui.queueFilter === f ? 'on' : ''}" aria-pressed="${ui.queueFilter === f}" data-act="q-filter" data-v="${f}">${l}<b>${cnt(f)}</b></button>`).join('')}${!isGuest() ? `<span class="spacer"></span><button class="chip btnchip ${ui.queueScope === 'mine' ? 'on' : ''}" aria-pressed="${ui.queueScope === 'mine'}" data-act="q-scope">${ic('user')}Only mine</button>` : ''}</div>`;
};
actions['q-filter'] = el => { ui.queueFilter = el.dataset.v; refresh('qFilters', 'qList'); };
actions['q-scope'] = () => { ui.queueScope = ui.queueScope === 'mine' ? 'all' : 'mine'; refresh('qFilters', 'qList'); };
REGIONS.qList = () => {
  let l = visibleJobs(); const f = ui.queueFilter;
  if (f === 'active') l = l.filter(j => ['Queued', 'Printing', 'Ready for Collection'].includes(j.status)); else if (f !== 'all') l = l.filter(j => j.status === f);
  if (ui.queueScope === 'mine') l = l.filter(isMine);
  l.sort(jobSort);
  if (!l.length) {
    const anyActive = S.jobs.some(j => ['Queued', 'Printing'].includes(j.status));
    return f === 'active' && !anyActive && ui.queueScope !== 'mine' ? emptyState({ icon: 'printer', title: 'The queue is clear', body: 'Printers are idle. A print sent now starts almost right away.', cta: `<button class="btn primary" data-act="go" data-v="studio">${ic('printer')}Print something</button>` })
      : emptyState({ icon: 'queue', title: ui.queueScope === 'mine' ? 'None of your jobs match' : 'No jobs with this status', body: 'Try another filter.', cta: `<button class="btn" data-act="q-filter" data-v="all">Show everything</button>` });
  }
  return `<div class="jobs">${l.slice(0, 60).map(j => jobRow(j)).join('')}</div>${l.length > 60 ? `<p class="muted sm center">Showing the first 60 of ${l.length}.</p>` : ''}`;
};

/* ---------- job detail ---------- */
actions['job-open'] = el => openJobSheet(el.dataset.id);
function openJobSheet(id) { openOverlay({ id: 'job', kind: 'sheet', title: '', render: () => jobSheet(id) }); const t = $('#ovt-job'); if (t) t.textContent = jobName(jobById(id)); }
function stepper(j) {
  const steps = ['Queued', 'Printing', 'Ready for Collection', 'Collected'], labels = ['Queued', 'Printing', 'Ready', 'Collected'];
  const idx = { Scheduled: -1, Queued: 0, Printing: 1, 'Ready for Collection': 2, Collected: 3 }[j.status] ?? (j.status === 'Failed' ? (j.startedAt ? 1 : 0) : 0);
  return `<ol class="steps" aria-label="Progress">${steps.map((s, i) => `<li class="${j.status === 'Failed' && i === idx ? 'failed' : j.status === 'Cancelled' ? '' : i < idx || (i === idx && j.status === 'Collected') ? 'done' : i === idx ? 'now' : ''}"><span>${(i < idx || (i === idx && j.status === 'Collected')) && j.status !== 'Failed' && j.status !== 'Cancelled' ? ic('check') : j.status === 'Failed' && i === idx ? ic('alert') : i + 1}</span><b>${labels[i]}</b></li>`).join('')}</ol>`;
}
function jobSheet(id) {
  const j = jobById(id); if (!j) return { body: emptyState({ icon: 'file', title: 'Job not found', body: 'It may have been removed.' }) };
  const full = isMine(j) || isAdmin(), p = printerById(j.printer), eta = jobEtaSec(j), prog = pct(j.done, j.impressions);
  const acts = [];
  if (full || isMine(j)) {
    if (j.status === 'Scheduled' && isMine(j) && !isGuest()) acts.push(`<button class="btn" data-act="task-edit-from-job" data-id="${j.id}">${ic('sliders')}Edit in planner</button><button class="btn primary" data-act="job-now" data-id="${j.id}">${ic('printer')}Print now</button>`);
    if (['Queued', 'Scheduled'].includes(j.status) && (isMine(j) || isAdmin())) acts.push(`<button class="btn ghost danger" data-act="job-cancel" data-id="${j.id}">${ic('ban')}Cancel</button>`);
    if (j.status === 'Failed' && (isMine(j) || isAdmin())) acts.push(`<button class="btn primary" data-act="job-retry" data-id="${j.id}">${ic('refresh')}Retry</button>`);
    if (j.status === 'Ready for Collection' && (isMine(j) || isAdmin())) acts.push(`<button class="btn primary" data-act="job-collect" data-id="${j.id}">${ic('check')}Mark as collected</button>`);
    if (['Collected', 'Failed', 'Cancelled'].includes(j.status) && isMine(j) && !isGuest()) acts.push(`<button class="btn" data-act="job-quick" data-id="${j.id}">${ic('zap')}Reprint now</button><button class="btn" data-act="job-reprint-close" data-id="${j.id}">${ic('printer')}Reprint with changes</button>`);
  }
  return {
    body: `<div class="jd"><div class="row between wrap"><div class="row wrap"><code class="order-chip">${j.order}</code>${pill(j.status)}</div><small class="muted">${esc(etaLabel(j))}</small></div>
    ${j.status === 'Printing' ? `<div>${bar(prog, 'live lg', `Printing ${prog}%`)}<div class="row between"><small>${Math.floor(j.done)} of ${j.impressions} pages</small><small>${eta != null ? fmtEta(eta) + ' left' : ''}</small></div></div>` : ''}
    ${j.status === 'Queued' ? `<p class="muted">#${queuePos(j) || '–'} in line${eta != null ? ' · about ' + fmtEta(eta).replace('~', '') + ' until ready' : ''}${p ? ' on ' + esc(p.name) : ''}.</p>` : ''}
    ${j.status === 'Failed' ? `<div class="notice bad">${ic('alert')}<div><b>${esc(j.fail.reason)}</b><br><small>Error ${esc(j.fail.code)} · ${ago(j.fail.at)}</small></div></div>` : ''}
    ${j.status === 'Ready for Collection' && (isMine(j) || isAdmin()) ? `<div class="ready-box"><div><small>Shelf</small><b>${j.shelf}</b></div><div><small>Pickup code</small><b class="code">${j.code}</b></div><div><small>Ready</small><b>${ago(j.readyAt)}</b></div></div>` : ''}
    ${j.status !== 'Scheduled' ? stepper(j) : `<p class="muted">Planned for <b>${fmtWhen(j.scheduled)}</b>. It joins the queue then.</p>`}
    <dl class="kv">${full ? `<div><dt>Files</dt><dd>${j.items.map(i => `${esc(i.name)} <small class="muted">${i.range ? 'p. ' + esc(i.range) : i.pages + ' p.'} × ${i.copies}</small>`).join('<br>')}</dd></div>` : ''}
      <div><dt>Settings</dt><dd>${esc(settingsLine(j.settings))}</dd></div><div><dt>Output</dt><dd>${plural(j.impressions, 'page')} on ${plural(j.sheets, 'sheet')}</dd></div><div><dt>Printer</dt><dd>${p ? esc(p.name) : 'Not assigned yet'}</dd></div>
      ${isAdmin() && j.owner ? `<div><dt>Owner</dt><dd>${esc(userById(j.owner).name)}</dd></div>` : ''}${j.guest && (isAdmin() || isMine(j)) ? `<div><dt>Guest</dt><dd>${esc(j.guest.name)} <small class="muted">${esc(j.guest.id)}</small></dd></div>` : ''}</dl>
    ${full ? `<details class="tl" ${j.status === 'Failed' ? 'open' : ''}><summary>Timeline <small class="muted">${plural(j.events.length, 'event')}</small></summary><ol>${j.events.slice().reverse().map(e => `<li><time>${fmtDate(e.t)}, ${fmtTime(e.t)}</time>${esc(e.text)}</li>`).join('')}</ol></details>` : `<p class="muted sm">${ic('lock')} File names and history are private to the person who printed.</p>`}</div>`,
    foot: acts.join('')
  };
}
actions['job-now'] = el => { const j = jobById(el.dataset.id); run('Print now', () => opPrintNow(j), { btn: el, ms: 350, onOk: () => { onSimChange(); toast({ kind: 'good', msg: `${j.order} is in the queue.` }); } }); };
actions['task-edit-from-job'] = el => { closeOverlay('job'); go('planner'); setTimeout(() => openTaskEditor(jobById(el.dataset.id), []), 400); };
actions['job-cancel'] = el => {
  const j = jobById(el.dataset.id); confirmDialog({ title: `Cancel ${j.order}?`, danger: true, confirm: 'Cancel print', cancel: 'Keep it', body: `<p>${j.status === 'Queued' ? `It's #${queuePos(j) || '–'} in line. ` : ''}Cancelling can't be undone.</p>`, onConfirm: () => run('Cancel print', () => opCancel(j), { onOk: () => { onSimChange(); closeOverlay('job'); toast({ kind: 'info', msg: `${j.order} cancelled.` }); } }) });
};
actions['job-retry'] = el => { const j = jobById(el.dataset.id); run('Retry', () => opRetry(j), { btn: el, ms: 420, onOk: () => { onSimChange(); toast({ kind: 'good', msg: `${j.order} is back in the queue${j.printer ? ' on ' + printerById(j.printer).name : ''}.` }); } }); };
actions['job-collect'] = el => { const j = jobById(el.dataset.id); run('Mark as collected', () => opCollected(j), { btn: el, ms: 300, onOk: () => { onSimChange(); closeOverlay('job'); toast({ kind: 'good', msg: `${j.order} marked as collected. Thanks.` }); } }); };
actions['job-reprint-close'] = el => { closeOverlay('job', true); reprintJobToStudio(jobById(el.dataset.id)); };
