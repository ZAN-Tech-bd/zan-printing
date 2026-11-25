/* =====================================================================
   11 Admin dashboard
   ===================================================================== */
const ADM_TABS = [['overview', 'Overview', 'activity'], ['queue', 'Queue', 'queue'], ['printers', 'Printers', 'printer'], ['users', 'Users', 'users'], ['storage', 'Storage', 'database'], ['audit', 'Audit log', 'history'], ['failed', 'Failed', 'alert'], ['analytics', 'Analytics', 'chart']];
const failedJobs = () => S.jobs.filter(j => j.status === 'Failed' && !j.dismissed);
const todayJobs = () => S.jobs.filter(j => j.created >= startOfDay(S.now) && j.status !== 'Cancelled');
VIEW_RENDER.admin = () => `${pageHead('Admin', `Lab operations · ${fmtDate(S.now)}`, `<span class="chip ${S.printers.every(p => p.status === 'online') ? 'good' : 'warn'}">${S.printers.every(p => p.status === 'online') ? ic('check') + 'All printers online' : ic('alert') + 'Printer attention needed'}</span>`)}
  ${reg('admTabs')}<div class="adm-body" data-region="admBody">${REGIONS.admBody()}</div>`;
REGIONS.admTabs = () => `<div class="tabs" role="tablist" aria-label="Admin sections">${ADM_TABS.map(([id, l, i]) => { const n = id === 'failed' ? failedJobs().length : id === 'printers' ? S.printers.filter(p => p.status !== 'online').length : 0; return `<button role="tab" class="tabx ${ui.adminTab === id ? 'on' : ''}" aria-selected="${ui.adminTab === id}" id="tab-${id}" data-act="adm-tab" data-v="${id}">${ic(i)}<span>${l}</span>${n ? `<b class="nb bad">${n}</b>` : ''}</button>`; }).join('')}</div>`;
actions['adm-tab'] = el => { ui.adminTab = el.dataset.v; refresh('admTabs', 'admBody'); window.scrollTo({ top: 0 }); };
REGIONS.admBody = () => ({ overview: admOverview, queue: admQueue, printers: admPrinters, users: admUsers, storage: admStorage, audit: admAudit, failed: admFailed, analytics: admAnalytics })[ui.adminTab]();
const admRefresh = () => { refresh('admTabs', 'admBody'); onSimChange(); };

/* ----- charts ----- */
const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
function chartFrame(W, H, max, ticks = 4) { const pl = 36, pr = 8, pt = 12, pb = 26; let g = ''; for (let i = 0; i <= ticks; i++) { const y = pt + (H - pt - pb) * (1 - i / ticks); g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="gl"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" class="ax">${Math.round(max * i / ticks)}</text>`; } return { pl, pr, pt, pb, g }; }
function barsSVG(vals, days, { label, hl = vals.length - 1 }) {
  const W = 640, H = 210, max = niceMax(Math.max(...vals)), f = chartFrame(W, H, max), n = vals.length, bw = (W - f.pl - f.pr) / n;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${f.g}${vals.map((v, i) => { const h = (H - f.pt - f.pb) * v / max, x = f.pl + i * bw + bw * .2, y = H - f.pb - h; return `<rect x="${x}" y="${y}" width="${bw * .6}" height="${Math.max(0, h)}" rx="3" class="${i === hl ? 'bar-hl' : dow(days[i]) === 5 ? 'bar-dim' : 'bar-n'}"/>${i === hl ? `<text x="${x + bw * .3}" y="${y - 5}" text-anchor="middle" class="ax b">${v}</text>` : ''}<text x="${x + bw * .3}" y="${H - 8}" text-anchor="middle" class="ax">${_f('dn', 'en-GB', { day: 'numeric' }).format(days[i])}</text>`; }).join('')}</svg>`;
}
function stackSVG(a, b, days, label) {
  const W = 640, H = 210, tot = a.map((v, i) => v + b[i]), max = niceMax(Math.max(...tot)), f = chartFrame(W, H, max), n = a.length, bw = (W - f.pl - f.pr) / n, sc = (H - f.pt - f.pb) / max;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${f.g}${a.map((v, i) => { const x = f.pl + i * bw + bw * .2, h1 = v * sc, h2 = b[i] * sc; return `<rect x="${x}" y="${H - f.pb - h1}" width="${bw * .6}" height="${h1}" class="s-mono"/><rect x="${x}" y="${H - f.pb - h1 - h2 - 1}" width="${bw * .6}" height="${h2}" rx="3" class="s-col"/><text x="${x + bw * .3}" y="${H - 8}" text-anchor="middle" class="ax">${_f('dn', 'en-GB', { day: 'numeric' }).format(days[i])}</text>`; }).join('')}</svg>`;
}
function lineSVG(vals, days, label, unit) {
  const W = 640, H = 190, max = niceMax(Math.max(...vals, 1)), f = chartFrame(W, H, max, 4), n = vals.length, st = (W - f.pl - f.pr) / (n - 1), pts = vals.map((v, i) => [f.pl + i * st, H - f.pb - (H - f.pt - f.pb) * v / max]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${f.g}<path d="${d} L${last[0]} ${H - f.pb} L${pts[0][0]} ${H - f.pb}Z" class="area"/><path d="${d}" class="ln"/><circle cx="${last[0]}" cy="${last[1]}" r="4.5" class="ln-dot"/><text x="${last[0] - 6}" y="${last[1] - 9}" text-anchor="end" class="ax b">${vals[vals.length - 1]}${unit}</text>${days.map((t, i) => i % 2 === 0 ? `<text x="${pts[i][0]}" y="${H - 8}" text-anchor="middle" class="ax">${_f('dn', 'en-GB', { day: 'numeric' }).format(t)}</text>` : '').join('')}</svg>`;
}
function statDays(n) {
  const d = S.stats.days.slice(-n).map(x => ({ ...x })), t = d[d.length - 1], tj = todayJobs();
  if (tj.length || S.scenario === 'empty') { t.jobs = tj.length; t.pages = tj.reduce((a, j) => a + j.impressions, 0); t.color = tj.filter(j => j.settings.color === 'color').reduce((a, j) => a + j.impressions, 0); t.mono = t.pages - t.color; t.failed = tj.filter(j => j.status === 'Failed').length; }
  return d;
}

/* ----- overview ----- */
function adminAlerts() {
  const a = [];
  S.printers.forEach(p => {
    if (p.status === 'jam') a.push({ sev: 'bad', t: `${p.name} has a paper jam`, d: 'Jobs on it failed or were rerouted. Clear the jam at the machine, then confirm here.', act: 'adm-printer', data: { id: p.id, k: 'clear' }, l: 'Mark jam cleared' });
    if (p.status === 'offline') a.push({ sev: 'bad', t: `${p.name} is offline`, d: 'Queued jobs were moved to other printers where possible.', act: 'adm-printer', data: { id: p.id, k: 'resume' }, l: 'Bring online' });
    if (p.paper < 15) a.push({ sev: 'warn', t: `${p.name}: paper is low (${Math.round(p.paper)}%)`, d: 'Refill soon to avoid jobs stalling.', act: 'adm-printer', data: { id: p.id, k: 'paper' }, l: 'Mark refilled' });
    const low = Object.entries(p.ink).filter(([, v]) => v < 15); if (low.length) a.push({ sev: 'warn', t: `${p.name}: ${low.map(([k, v]) => k + ' ' + Math.round(v) + '%').join(', ')} low`, d: p.caps.color ? 'Order replacement ink.' : 'Order a replacement toner cartridge.', act: 'adm-printer', data: { id: p.id, k: 'ink' }, l: 'Mark replaced' });
  });
  const f = failedJobs().length; if (f) a.push({ sev: 'bad', t: `${plural(f, 'failed job')} to review`, d: 'Retry them, reroute, or tell the owners.', act: 'adm-tab', data: { v: 'failed' }, l: 'Review' });
  const full = S.users.filter(u => u.status === 'active' && pct(usedBytes(u), u.quota) >= 90); if (full.length) a.push({ sev: 'warn', t: `${plural(full.length, 'user')} above 90% storage`, d: full.map(u => u.name).join(', '), act: 'adm-tab', data: { v: 'storage' }, l: 'Open storage' });
  const den = S.audit.filter(x => x.result === 'denied' && x.action === 'auth.login' && S.now - x.t < 6 * HOUR).length; if (den >= 2) a.push({ sev: 'warn', t: `${plural(den, 'denied sign-in')} in the last 6 hours`, d: 'Repeated attempts on an admin account from outside the lab network.', act: 'adm-audit-denied', data: {}, l: 'Inspect' });
  return a;
}
function admOverview() {
  const al = adminAlerts(), days = statDays(14), shown = ui.admAlertsAll ? al : al.slice(0, 3), more = al.length - shown.length;
  const alertHTML = al.length ? `<section class="alerts" aria-label="Needs attention"><div class="row between"><h2 class="sec-h">Needs attention <span class="count">${al.length}</span></h2>${al.length > 3 ? `<button class="link" data-act="adm-alerts-all">${ui.admAlertsAll ? 'Show fewer' : `Show ${more} more`}</button>` : ''}</div>${shown.map(a => `<div class="alert ${a.sev}">${ic('alert')}<div><b>${esc(a.t)}</b><small>${esc(a.d)}</small></div><button class="btn sm" data-act="${a.act}" ${Object.entries(a.data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(a.l)}</button></div>`).join('')}</section>` : `<div class="card calm">${ic('check')}<div><b>All clear</b><small class="muted">No printer issues, failed jobs or storage problems.</small></div></div>`;
  return `<div class="adm-ov">${reg('admKpis')}${alertHTML}
  <section><h2 class="sec-h">Printers</h2><div class="pcards" data-region="admPrinters">${REGIONS.admPrinters()}</div></section>
  <div class="grid-2"><section class="card"><div class="row between"><h2 class="sec-h">Live queue</h2><button class="link" data-act="adm-tab" data-v="queue">Manage</button></div>${reg('admQueueMini')}</section>
  <section class="card"><h2 class="sec-h">Jobs per day <small class="muted">last 14 days</small></h2>${barsSVG(days.map(d => d.jobs), days.map(d => d.t), { label: 'Jobs per day over the last 14 days. Fridays are low because the lab is closed.' })}<p class="muted sm">Fridays are quiet: the lab is closed.</p></section></div></div>`;
}
actions['adm-alerts-all'] = () => { ui.admAlertsAll = !ui.admAlertsAll; refresh('admBody'); };
REGIONS.admKpis = () => {
  const tj = todayJobs(), act = S.jobs.filter(j => ['Queued', 'Printing'].includes(j.status)), q = S.jobs.filter(j => j.status === 'Queued').map(jobEtaSec).filter(x => x != null), avg = q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0;
  const seed = S.stats.days[S.stats.days.length - 1], pages = tj.reduce((a, j) => a + j.impressions, 0), fail = tj.filter(j => j.status === 'Failed').length + (tj.length ? 0 : 0), ready = S.jobs.filter(j => j.status === 'Ready for Collection').length;
  const k = (l, v, sub, tone = '', ic2 = 'activity') => `<div class="kpi ${tone}"><span class="kpi-ic">${ic(ic2)}</span><div><small>${l}</small><b>${v}</b><em>${sub}</em></div></div>`;
  return `<section class="kpis" aria-label="Today at a glance">${k('Active jobs', act.length, `${S.jobs.filter(j => j.status === 'Printing').length} printing · ${S.jobs.filter(j => j.status === 'Queued').length} waiting`, '', 'queue')}${k('Avg wait', q.length ? fmtEta(avg).replace('~', '') : 'None', 'for waiting jobs', '', 'clock')}${k('Pages today', pages.toLocaleString('en'), plural(tj.length, 'job') + ' since 9 AM', '', 'file')}${k('Failure rate', tj.length ? Math.round(fail / tj.length * 100) + '%' : '0%', plural(fail, 'failed job') + ' today', fail ? 'bad' : '', 'alert')}${k('Awaiting pickup', ready, ready ? 'on the collection shelves' : 'shelves are empty', ready > 3 ? 'warn' : '', 'box')}</section>`;
};
REGIONS.admPrinters = () => S.printers.map(printerCard).join('');
REGIONS.admQueueMini = () => { const l = S.jobs.filter(j => ['Printing', 'Queued', 'Ready for Collection'].includes(j.status)).sort(jobSort).slice(0, 6); return l.length ? `<div class="jobs">${l.map(j => jobRow(j, { owner: true })).join('')}</div>` : emptyState({ icon: 'printer', title: 'Queue is empty', body: 'Nothing waiting or printing.' }); };
actions['adm-audit-denied'] = () => { ui.adminTab = 'audit'; ui.auditRes = 'denied'; ui.auditCat = 'auth'; refresh('admTabs', 'admBody'); };

/* ----- queue management ----- */
const ADM_Q = [['active', 'Active'], ['Queued', 'Queued'], ['Printing', 'Printing'], ['Ready for Collection', 'Ready'], ['Scheduled', 'Scheduled'], ['Failed', 'Failed'], ['all', 'All']];
function admQueue() {
  const anyPaused = S.printers.some(p => p.status === 'paused');
  return `<div class="row between wrap"><div class="chips-scroll" role="group" aria-label="Filter queue">${ADM_Q.map(([f, l]) => `<button class="chip btnchip ${ui.adminQueueFilter === f ? 'on' : ''}" aria-pressed="${ui.adminQueueFilter === f}" data-act="adm-qf" data-v="${f}">${l}</button>`).join('')}</div>
  <button class="btn sm" data-act="adm-pause-all">${ic(anyPaused ? 'play' : 'pause')}${anyPaused ? 'Resume all printers' : 'Pause all printers'}</button></div><div data-region="admQueueTable">${REGIONS.admQueueTable()}</div>`;
}
actions['adm-qf'] = el => { ui.adminQueueFilter = el.dataset.v; refresh('admBody'); };
actions['adm-pause-all'] = () => { const pause = !S.printers.some(p => p.status === 'paused'); run(pause ? 'Pause printers' : 'Resume printers', () => S.printers.forEach(p => { if (pause && p.status === 'online') printerAction(p, 'pause'); else if (!pause && p.status === 'paused') printerAction(p, 'resume'); }), { ms: 400, onOk: () => { admRefresh(); toast({ kind: 'info', msg: pause ? 'All printers paused. Jobs keep queuing.' : 'Printers resumed.' }); } }); };
REGIONS.admQueueTable = () => {
  let l = S.jobs.slice(); const f = ui.adminQueueFilter;
  if (f === 'active') l = l.filter(j => ['Queued', 'Printing', 'Ready for Collection'].includes(j.status)); else if (f !== 'all') l = l.filter(j => j.status === f);
  l.sort(jobSort); if (!l.length) return emptyState({ icon: 'queue', title: 'No jobs here', body: 'Nothing matches this filter.' });
  const queuedByP = {}; S.jobs.filter(j => j.status === 'Queued').sort((a, b) => a.qkey - b.qkey).forEach(j => (queuedByP[j.printer] = queuedByP[j.printer] || []).push(j));
  return `<div class="atable" role="table" aria-label="Global queue"><div class="ahead" role="row"><span>Order</span><span>Owner and files</span><span>Printer</span><span>Status</span><span>Actions</span></div>${l.slice(0, 50).map(j => {
    const own = j.owner ? userById(j.owner) : null, p = printerById(j.printer), arr = queuedByP[j.printer] || [], idx = arr.indexOf(j);
    return `<div class="arow s-${STATUS_META[j.status].cls}" role="row"><span class="c-id"><code>${j.order}</code><small class="muted">${fmtTime(j.created)}</small></span>
      <span class="c-who"><b>${esc(own ? own.name : 'Guest ' + (j.guest ? j.guest.id : ''))}</b><small class="muted">${esc(jobTitle(j))} · ${plural(j.sheets, 'sheet')}</small></span>
      <span class="c-p">${p ? esc(p.name) : '<em class="muted">Unassigned</em>'}</span>
      <span class="c-s">${pill(j.status)}<small class="muted">${esc(etaLabel(j))}</small>${j.status === 'Printing' ? bar(pct(j.done, j.impressions), 'live', 'Progress') : ''}</span>
      <span class="c-a">${j.status === 'Queued' ? `<button class="icon-btn sm" data-act="adm-move" data-id="${j.id}" data-d="-1" aria-label="Move ${j.order} up" ${idx <= 0 ? 'disabled' : ''}>${ic('up')}</button><button class="icon-btn sm" data-act="adm-move" data-id="${j.id}" data-d="1" aria-label="Move ${j.order} down" ${idx < 0 || idx >= arr.length - 1 ? 'disabled' : ''}>${ic('down')}</button>` : ''}<button class="icon-btn sm" data-act="job-open" data-id="${j.id}" aria-label="Details for ${j.order}">${ic('eye')}</button><button class="icon-btn sm" data-act="adm-job-menu" data-id="${j.id}" aria-label="More actions for ${j.order}" aria-haspopup="menu">${ic('more')}</button></span></div>`;
  }).join('')}</div>`;
};
actions['adm-move'] = el => {
  const j = jobById(el.dataset.id), arr = S.jobs.filter(x => x.status === 'Queued' && x.printer === j.printer).sort((a, b) => a.qkey - b.qkey), i = arr.indexOf(j), o = arr[i + +el.dataset.d]; if (!o) return;
  [j.qkey, o.qkey] = [o.qkey, j.qkey]; ev(j, `Queue position changed by admin`); audit('queue.reorder', j.order, { detail: `Swapped with ${o.order}` }); refresh('admQueueTable', 'admQueueMini'); const b = $(`[data-act="adm-move"][data-id="${j.id}"][data-d="${el.dataset.d}"]`); if (b && !b.disabled) b.focus();
};
actions['adm-job-menu'] = el => {
  const j = jobById(el.dataset.id), it = [];
  if (j.status === 'Queued') { it.push({ label: 'Move to front', icon: 'up', act: 'adm-bump', data: { id: j.id } }); S.printers.filter(p => p.id !== j.printer && !printerIssues(p, j.settings).length).forEach(p => it.push({ label: 'Send to ' + p.name, icon: 'printer', act: 'adm-reassign', data: { id: j.id, p: p.id } })); }
  if (['Queued', 'Printing'].includes(j.status)) it.push({ label: 'Mark ready for collection', icon: 'box', act: 'adm-ready', data: { id: j.id } });
  if (j.status === 'Failed') it.push({ label: 'Retry', icon: 'refresh', act: 'adm-retry', data: { id: j.id } });
  if (j.status === 'Ready for Collection') it.push({ label: 'Mark collected', icon: 'check', act: 'job-collect', data: { id: j.id } });
  if (['Queued', 'Scheduled', 'Printing'].includes(j.status)) { it.push({ sep: 1 }); it.push({ label: 'Cancel job', icon: 'ban', act: 'job-cancel', data: { id: j.id }, danger: true }); }
  if (!it.length) it.push({ label: 'No actions for this status', icon: 'info', act: 'noop', disabled: true });
  openMenu(el, it, { title: j.order });
};
actions['noop'] = () => { };
actions['adm-bump'] = el => { const j = jobById(el.dataset.id); run('Move to front', () => opBump(j), { ms: 250, onOk: () => { admRefresh(); toast({ kind: 'good', msg: `${j.order} is now next on ${printerById(j.printer).name}.` }); } }); };
actions['adm-reassign'] = el => { const j = jobById(el.dataset.id), p = printerById(el.dataset.p); run('Reassign', () => { j.printer = p.id; j.printerPref = p.id; ev(j, `Sent to ${p.name} by admin`); audit('queue.reassign', j.order, { detail: p.name }); }, { ms: 250, onOk: () => { admRefresh(); toast({ kind: 'good', msg: `${j.order} sent to ${p.name}.` }); } }); };
actions['adm-ready'] = el => { const j = jobById(el.dataset.id); run('Mark ready', () => { const p = printerById(j.printer) || S.printers[0]; if (j.status === 'Queued') { j.status = 'Printing'; } finishJob(j, p); }, { ms: 250, onOk: () => { admRefresh(); toast({ kind: 'good', msg: `${j.order} is ready on shelf ${j.shelf}.` }); } }); };
actions['adm-retry'] = el => { const j = jobById(el.dataset.id); run('Retry', () => opRetry(j), { ms: 300, btn: el, onOk: () => { admRefresh(); toast({ kind: 'good', msg: `${j.order} is back in the queue.` }); } }); };

/* ----- printers ----- */
function admPrinters() { return `<div data-region="admPrinterCards" class="pgrid">${REGIONS.admPrinterCards()}</div>`; }
REGIONS.admPrinterCards = () => S.printers.map(p => {
  const job = S.jobs.find(j => j.status === 'Printing' && j.printer === p.id), st = p.status !== 'online' ? p.status : job ? 'printing' : 'ready', lbl = { printing: 'Printing', ready: 'Ready', paused: 'Paused', jam: 'Paper jam', offline: 'Offline' }[st];
  const m = (l, v, c = '') => `<div class="meter ${v < 15 ? 'low' : ''}"><span>${l}</span>${bar(v, c, l + ' ' + Math.round(v) + '%')}<b>${Math.round(v)}%</b></div>`;
  const inkc = { K: 'k', C: 'c', M: 'm', Y: 'y' };
  return `<article class="card pdetail" aria-label="${esc(p.name)}"><div class="row between"><div><h3>${esc(p.name)}</h3><small class="muted">${esc(p.model)} · ${esc(p.serial)}</small></div><span class="pstat ${st}"><i></i>${lbl}</span></div>
    <p class="muted sm">${esc(p.loc)} · ${p.ppm} pages/min · ${p.caps.color ? 'Colour' : 'B/W'}${p.caps.duplex ? ' · Duplex' : ''} · ${p.caps.paper.join(', ')}</p>
    ${job ? `<div class="p-now"><div class="row between"><small><code>${job.order}</code> ${esc(userById(job.owner) ? userById(job.owner).name : 'Guest')}</small><small>${pct(job.done, job.impressions)}%</small></div>${bar(pct(job.done, job.impressions), 'live', 'Current job')}</div>` : ''}
    <div class="meters">${m('Paper', p.paper)}${Object.entries(p.ink).map(([k, v]) => m((p.caps.color ? 'Ink ' : 'Toner ') + k, v, 'ink-' + inkc[k])).join('')}</div>
    <p class="muted sm">${p.pages.toLocaleString('en')} pages printed in total</p>
    ${p.errors.length ? `<ul class="errs">${p.errors.slice(0, 2).map(e => `<li>${ic('alert')}<span>${esc(e.text)}</span><small>${ago(e.t)}</small></li>`).join('')}</ul>` : '<p class="muted sm">No recent errors.</p>'}
    <div class="row wrap pact">${p.status === 'jam' ? `<button class="btn sm primary" data-act="adm-printer" data-id="${p.id}" data-k="clear">${ic('wrench')}Mark jam cleared</button>` : p.status === 'online' ? `<button class="btn sm" data-act="adm-printer" data-id="${p.id}" data-k="pause">${ic('pause')}Pause</button>` : `<button class="btn sm primary" data-act="adm-printer" data-id="${p.id}" data-k="resume">${ic('play')}${p.status === 'offline' ? 'Bring online' : 'Resume'}</button>`}<button class="btn sm" data-act="adm-printer" data-id="${p.id}" data-k="paper">${ic('file')}Refilled paper</button><button class="btn sm" data-act="adm-printer" data-id="${p.id}" data-k="ink">${ic('droplet')}Replaced ${p.caps.color ? 'ink' : 'toner'}</button>${p.status === 'online' ? `<button class="btn sm ghost danger" data-act="adm-printer" data-id="${p.id}" data-k="jam">${ic('alert')}Simulate jam</button>` : ''}</div></article>`;
}).join('');
actions['adm-printer'] = el => { const p = printerById(el.dataset.id), k = el.dataset.k; run('Update printer', () => printerAction(p, k), { btn: el, ms: 380, onOk: l => { admRefresh(); toast({ kind: k === 'jam' ? 'warn' : 'good', msg: `${p.name}: ${l.toLowerCase()}.` }); } }); };

/* ----- users ----- */
function admUsers() {
  const q = ui.usersQ.trim().toLowerCase(), l = S.users.filter(u => !q || (u.name + u.email + u.org).toLowerCase().includes(q));
  return `<div class="row between wrap"><div class="searchbox">${ic('search')}<input id="users-q" class="input" type="search" placeholder="Search users" value="${esc(ui.usersQ)}" data-in="usersq" aria-label="Search users"/></div><button class="btn primary" data-act="adm-invite">${ic('plus')}Invite user</button></div>
  ${l.length ? `<div class="atable users" role="table" aria-label="Users"><div class="ahead" role="row"><span>User</span><span>Role</span><span>Storage</span><span>This month</span><span>Actions</span></div>${l.map(u => { const used = usedBytes(u), p = pct(used, u.quota); return `<div class="arow" role="row"><span class="c-who">${avatar(u, 36)}<span><b>${esc(u.name)}</b><small class="muted">${esc(u.email)}</small></span></span><span class="c-p">${u.role === 'admin' ? chip('Admin', 'accent', 'shield') : chip('User')}${u.status === 'suspended' ? chip('Suspended', 'bad', 'ban') : ''}<small class="muted">${esc(u.org)}</small></span><span class="c-s"><div class="row between"><small>${fmtMB(used)} MB</small><small class="${p >= 95 ? 'bad-t' : p >= 80 ? 'warn-t' : 'muted'}">${p}%</small></div>${storageBar(u)}</span><span class="c-m"><b>${u.jobsMonth}</b> jobs<small class="muted">${u.pagesMonth.toLocaleString('en')} pages · seen ${ago(u.lastSeen)} ${u.net === 'lan' ? '' : '(remote)'}</small></span><span class="c-a"><button class="icon-btn sm" data-act="adm-user-menu" data-id="${u.id}" aria-label="Actions for ${esc(u.name)}" aria-haspopup="menu">${ic('more')}</button></span></div>`; }).join('')}</div>` : emptyState({ icon: 'users', title: 'No users match', body: 'Try another name or email.' })}`;
}
inputs.usersq = el => { ui.usersQ = el.value; refresh('admBody'); };
actions['adm-user-menu'] = el => {
  const u = userById(el.dataset.id), self = u.id === S.session.uid;
  openMenu(el, [{ label: u.status === 'suspended' ? 'Reactivate account' : 'Suspend account', icon: u.status === 'suspended' ? 'check' : 'ban', act: 'adm-suspend', data: { id: u.id }, disabled: self, hint: self ? "That's you" : '' }, { label: 'Send password reset', icon: 'lock', act: 'adm-reset', data: { id: u.id } }, { label: 'Clear stored files', icon: 'trash', act: 'adm-clear', data: { id: u.id }, danger: true, disabled: usedBytes(u) === 0 }, { sep: 1 }, { label: 'View audit trail', icon: 'history', act: 'adm-user-audit', data: { id: u.id } }], { title: u.name });
};
actions['adm-suspend'] = el => { const u = userById(el.dataset.id), s = u.status !== 'suspended'; const go2 = () => run(s ? 'Suspend' : 'Reactivate', () => { u.status = s ? 'suspended' : 'active'; audit(s ? 'user.suspend' : 'user.reactivate', u.name); }, { ms: 300, onOk: () => { admRefresh(); toast({ kind: 'info', msg: `${u.name} is ${s ? 'suspended. Queued jobs keep printing.' : 'active again.'}` }); } }); s ? confirmDialog({ title: `Suspend ${u.name}?`, danger: true, confirm: 'Suspend', body: '<p>They will be signed out and cannot sign in. Jobs already in the queue still print.</p>', onConfirm: go2 }) : go2(); };
actions['adm-reset'] = el => { const u = userById(el.dataset.id); run('Send reset', () => audit('user.reset_password', u.name, { detail: 'Reset link emailed' }), { ms: 400, onOk: () => toast({ kind: 'good', msg: `Reset link sent to ${u.email}.` }) }); };
actions['adm-clear'] = el => { const u = userById(el.dataset.id); confirmDialog({ title: `Clear ${u.name}'s files?`, danger: true, confirm: 'Delete all files', body: `<p>This permanently removes ${fmtMB(usedBytes(u))} MB, including pinned files. It can't be undone.</p>`, onConfirm: () => run('Clear storage', () => { const b = usedBytes(u); S.files = S.files.filter(f => f.owner !== u.id); u.usedStatic = 0; audit('storage.clear', u.name, { detail: `${fmtMB(b)} MB removed by admin` }); }, { ms: 500, onOk: () => { admRefresh(); toast({ kind: 'info', msg: `Cleared ${u.name}'s storage.` }); } }) }); };
actions['adm-user-audit'] = el => { ui.adminTab = 'audit'; ui.auditQ = userById(el.dataset.id).name; ui.auditCat = 'all'; ui.auditRes = 'all'; refresh('admTabs', 'admBody'); };
let inviteForm = null;
const _setBase = actions['set'];
actions['set'] = el => { if (el.dataset.scope === 'inv' && inviteForm) { inviteForm.role = el.dataset.v; refreshOverlay('invite'); } else _setBase(el); };
actions['adm-invite'] = () => {
  const f = { name: '', email: '', role: 'user', err: '' };
  openOverlay({ id: 'invite', kind: 'dialog', title: 'Invite a user', render: () => ({ body: `<div class="field"><label class="lbl" for="iv-name">Full name</label><input id="iv-name" class="input" data-in="ivname" value="${esc(f.name)}" autocomplete="off"/></div><div class="field"><label class="lbl" for="iv-email">Email</label><input id="iv-email" class="input" type="email" data-in="ivemail" value="${esc(f.email)}" autocomplete="off"/></div><div class="field"><label class="lbl">Role</label>${seg('inv', 'role', [{ v: 'user', l: 'User' }, { v: 'admin', l: 'Admin' }], f.role, { label: 'Role' })}</div>${f.err ? `<div class="notice bad" role="alert">${ic('alert')}<div>${esc(f.err)}</div></div>` : ''}<p class="muted sm">They get 100 MB of storage and an email with a sign-in link.</p>`, foot: `<button class="btn ghost" data-act="ov-close" data-id="invite">Cancel</button><button class="btn primary" data-act="iv-send">Send invite</button>` }) });
  inputs.ivname = el => { f.name = el.value; }; inputs.ivemail = el => { f.email = el.value; };
  inviteForm = f;
  actions['iv-send'] = el => {
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { f.err = 'Enter a name and a valid email address.'; return refreshOverlay('invite'); }
    if (S.users.some(u => u.email.toLowerCase() === f.email.toLowerCase())) { f.err = 'That email already has an account.'; return refreshOverlay('invite'); }
    run('Send invite', () => { const u = { id: uid('u'), name: f.name.trim(), email: f.email.trim(), role: f.role, org: 'Invited', usedStatic: 0, quota: 100 * MB, status: 'active', phone: '', net: 'lan', joined: S.now, lastSeen: S.now, wa: { connected: false, lang: 'en', time: '08:00' }, prefs: { save: true, autoClean: true, defRem: { 0: true, 1: false, 2: false }, last: { paper: 'A4', color: 'bw', orient: 'auto', duplex: 'long' } }, jobsMonth: 0, pagesMonth: 0 }; S.users.push(u); S.wa[u.id] = []; audit('user.invite', u.name, { detail: u.email + ' as ' + u.role }); return u; }, { btn: el, ms: 500, onOk: u => { closeOverlay('invite'); admRefresh(); toast({ kind: 'good', msg: `Invite sent to ${u.email}.` }); } });
  };
};

/* ----- storage ----- */
function admStorage() {
  const us = S.users.filter(u => u.status === 'active'), cap = us.length * 100 * MB, used = us.reduce((a, u) => a + usedBytes(u), 0), p = pct(used, cap), top = us.slice().sort((a, b) => usedBytes(b) - usedBytes(a)), hot = top.filter(u => pct(usedBytes(u), u.quota) >= 90), log = S.cleaned.slice(0, 6);
  return `<div class="grid-2"><section class="card"><h2 class="sec-h">Lab storage</h2><div class="st-nums"><div class="big-n"><b>${fmtMB(used)}</b><span>of ${cap / MB} MB across ${plural(us.length, 'active user')}</span></div></div><div class="sbar ${p >= 90 ? 'bad' : p >= 75 ? 'warn' : 'ok'}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Lab storage ${p}% used"><i class="k-doc" style="width:${p}%"></i></div><p class="muted sm">${p}% used. Each user has a 100 MB quota. Oldest unprotected files are auto-removed when a user runs out.</p>
    <div class="row wrap"><button class="btn" data-act="adm-notify-full" ${hot.length ? '' : 'disabled'}>${ic('bell')}Notify ${hot.length} ${hot.length === 1 ? 'user' : 'users'} above 90%</button></div></section>
  <section class="card"><h2 class="sec-h">Recent auto-clean</h2>${log.length ? `<ul class="clean-log">${log.map(c => `<li><b>${esc(userById(c.uid) ? userById(c.uid).name : 'User')}</b> <span class="muted">${ago(c.t)}</span><small>${plural(c.files.length, 'file')}, ${fmtMB(c.bytes)} MB: ${esc(c.files.join(', '))}</small></li>`).join('')}</ul>` : '<p class="muted">No files have been auto-removed this session. Try printing a large sample file as Nakib.</p>'}</section></div>
  <section class="card flush"><h2 class="sec-h pad">Usage by user</h2><ul class="usage">${top.map(u => { const pp = pct(usedBytes(u), u.quota); return `<li>${avatar(u, 30)}<span class="u-n"><b>${esc(u.name)}</b><small class="muted">${fmtMB(usedBytes(u))} MB${userFiles(u.id).length ? ' · ' + plural(userFiles(u.id).length, 'file') : ''}</small></span>${storageBar(u)}<span class="chip ${pp >= 95 ? 'bad' : pp >= 80 ? 'warn' : ''}">${pp}%</span></li>`; }).join('')}</ul></section>`;
}
actions['adm-notify-full'] = el => { const hot = S.users.filter(u => u.status === 'active' && pct(usedBytes(u), u.quota) >= 90); run('Notify users', () => hot.forEach(u => { notify(u.id, { type: 'storage', title: `My Files is ${pct(usedBytes(u), u.quota)}% full`, body: 'Delete files you no longer need, or pin the ones to keep.', link: 'files' }, { pop: false }); audit('storage.notify', u.name, { detail: 'Storage warning sent' }); }), { btn: el, ms: 450, onOk: () => toast({ kind: 'good', msg: `Warned ${plural(hot.length, 'user')}.` }) }); };

/* ----- audit ----- */
const AUDIT_CATS = [['all', 'All'], ['auth', 'Sign-ins'], ['job', 'Jobs'], ['file', 'Files'], ['planner', 'Planner'], ['printer', 'Printers'], ['wa', 'WhatsApp'], ['user', 'Users'], ['guest', 'Guests']];
const auditCat = a => { const p = a.action.split('.')[0]; return ['reminder'].includes(p) ? 'wa' : ['queue'].includes(p) ? 'job' : ['storage'].includes(p) ? 'file' : p; };
function auditFiltered() {
  const q = ui.auditQ.trim().toLowerCase();
  return S.audit.filter(a => (ui.auditCat === 'all' || auditCat(a) === ui.auditCat) && (ui.auditRes === 'all' || a.result === ui.auditRes) && (!q || (a.actor + ' ' + a.action + ' ' + a.target + ' ' + a.detail + ' ' + a.ip).toLowerCase().includes(q)));
}
function admAudit() { return `<div class="audit-bar"><div class="searchbox">${ic('search')}<input id="audit-q" class="input" type="search" placeholder="Search actor, action, target or IP" value="${esc(ui.auditQ)}" data-in="auditq" aria-label="Search audit log"/></div>
  <label class="sel-wrap"><span class="sr">Category</span><select id="audit-cat" class="input sm" data-in="auditcat" aria-label="Category">${AUDIT_CATS.map(([v, l]) => `<option value="${v}" ${ui.auditCat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <div class="chips-scroll" role="group" aria-label="Result">${[['all', 'Any result'], ['success', 'Success'], ['failed', 'Failed'], ['denied', 'Denied']].map(([v, l]) => `<button class="chip btnchip ${ui.auditRes === v ? 'on' : ''}" aria-pressed="${ui.auditRes === v}" data-act="audit-res" data-v="${v}">${l}</button>`).join('')}</div>
  <button class="btn sm" data-act="audit-copy">${ic('copy')}Copy CSV</button></div><div data-region="auditList">${REGIONS.auditList()}</div>`; }
REGIONS.auditList = () => {
  const l = auditFiltered(); if (!l.length) return emptyState({ icon: 'history', title: 'No matching entries', body: 'Try clearing the search or filters.', cta: `<button class="btn" data-act="audit-clear">Clear filters</button>` });
  const shown = l.slice(0, ui.auditN);
  return `<p class="muted sm" aria-live="polite">${plural(l.length, 'entry', 'entries')}</p><div class="atable audit" role="table" aria-label="Audit log"><div class="ahead" role="row"><span>Time</span><span>Who</span><span>Action</span><span>Result</span><span>Origin</span></div>${shown.map(a => `<div class="arow-w"><button class="arow ${a.result}" role="row" data-act="audit-open" data-id="${a.id}" aria-expanded="${ui.auditOpen === a.id}"><span class="c-id"><b>${fmtTime(a.t)}</b><small class="muted">${fmtDate(a.t)}</small></span><span class="c-who"><b>${esc(a.actor)}</b><small class="muted">${esc(a.role)}</small></span><span class="c-p"><code>${esc(a.action)}</code><small class="muted">${esc(a.target)}</small></span><span class="c-s"><span class="pill r-${a.result}">${ic(a.result === 'success' ? 'check' : a.result === 'denied' ? 'lock' : 'alert')}${a.result}</span></span><span class="c-m"><small>${a.net === 'lan' ? 'Lab network' : 'Remote'}</small><small class="muted">${esc(a.ip)}</small></span></button>${ui.auditOpen === a.id ? `<dl class="kv audit-d"><div><dt>Event ID</dt><dd><code>${a.id}</code></dd></div><div><dt>When</dt><dd>${fmtDateLong(a.t)}, ${fmtTime(a.t)} (Dhaka)</dd></div><div><dt>Actor</dt><dd>${esc(a.actor)} (${esc(a.role)})</dd></div><div><dt>Target</dt><dd>${esc(a.target) || 'n/a'}</dd></div><div><dt>Detail</dt><dd>${esc(a.detail) || 'n/a'}</dd></div><div><dt>Origin</dt><dd>${a.net === 'lan' ? 'Lab network' : 'Outside lab network'} · ${esc(a.ip)}</dd></div></dl>` : ''}</div>`).join('')}</div>${l.length > shown.length ? `<div class="row center"><button class="btn" data-act="audit-more">Show ${Math.min(20, l.length - shown.length)} more</button></div>` : ''}`;
};
inputs.auditq = el => { ui.auditQ = el.value; ui.auditN = 20; refresh('auditList'); };
inputs.auditcat = el => { ui.auditCat = el.value; ui.auditN = 20; refresh('auditList'); };
actions['audit-res'] = el => { ui.auditRes = el.dataset.v; ui.auditN = 20; refresh('admBody'); };
actions['audit-open'] = el => { ui.auditOpen = ui.auditOpen === el.dataset.id ? null : el.dataset.id; refresh('auditList'); };
actions['audit-more'] = () => { ui.auditN += 20; refresh('auditList'); };
actions['audit-clear'] = () => { ui.auditQ = ''; ui.auditCat = 'all'; ui.auditRes = 'all'; refresh('admBody'); };
actions['audit-copy'] = async () => {
  const rows = auditFiltered().slice(0, 500).map(a => [new Date(a.t).toISOString(), a.actor, a.role, a.action, a.target, a.result, a.net, a.ip, a.detail].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
  const csv = 'time,actor,role,action,target,result,network,ip,detail\n' + rows.join('\n');
  try { await navigator.clipboard.writeText(csv); toast({ kind: 'good', msg: `Copied ${plural(rows.length, 'row')} as CSV.` }); } catch (e) { toast({ kind: 'warn', msg: 'Your browser blocked copying. Use a larger window or allow clipboard access.' }); }
};

/* ----- failed jobs ----- */
function admFailed() {
  const l = failedJobs().sort((a, b) => b.fail.at - a.fail.at);
  if (!l.length) return emptyState({ icon: 'check', title: 'No failed jobs', body: 'Everything that was sent to a printer has printed or been handled.' });
  return `<div class="stack">${l.map(j => { const own = j.owner ? userById(j.owner) : null, p = printerById(j.printer); return `<article class="card failed-c"><div class="row between wrap"><div><b>${esc(jobTitle(j))}</b><div class="job-meta"><code>${j.order}</code><span>${esc(own ? own.name : 'Guest')}</span><span>${p ? esc(p.name) : ''}</span><span>${ago(j.fail.at)}</span></div></div>${pill('Failed')}</div>
    <div class="notice bad">${ic('alert')}<div><b>${esc(j.fail.reason)}</b><br><small>Error ${esc(j.fail.code)} · ${Math.floor(j.done)} of ${j.impressions} pages printed</small></div></div>
    <div class="row wrap"><button class="btn sm primary" data-act="adm-retry" data-id="${j.id}">${ic('refresh')}Retry${j.done >= 1 ? ' from page ' + (Math.floor(j.done) + 1) : ''}</button><button class="btn sm" data-act="adm-fail-route" data-id="${j.id}" aria-haspopup="menu">${ic('printer')}Retry on another printer</button><button class="btn sm" data-act="adm-fail-notify" data-id="${j.id}">${ic('bell')}Tell the owner</button><button class="btn sm ghost" data-act="adm-fail-dismiss" data-id="${j.id}">Dismiss</button></div></article>`; }).join('')}</div>`;
}
actions['adm-fail-route'] = el => { const j = jobById(el.dataset.id), ok = S.printers.filter(p => p.status === 'online' && p.id !== j.printer && !printerIssues(p, j.settings).length); openMenu(el, ok.length ? ok.map(p => ({ label: p.name, icon: 'printer', act: 'adm-retry-on', data: { id: j.id, p: p.id }, hint: 'wait ' + fmtEta(printerWaitSec(p)) })) : [{ label: 'No other printer fits these settings', icon: 'info', act: 'noop', disabled: true }], { title: 'Retry on…' }); };
actions['adm-retry-on'] = el => { const j = jobById(el.dataset.id), p = printerById(el.dataset.p); run('Retry', () => opRetry(j, { printer: p.id }), { ms: 350, onOk: () => { admRefresh(); toast({ kind: 'good', msg: `${j.order} retried on ${p.name}.` }); } }); };
actions['adm-fail-notify'] = el => { const j = jobById(el.dataset.id); run('Notify owner', () => { if (j.owner) notify(j.owner, { type: 'failed', title: `${j.order} needs your attention`, body: 'The lab team is aware. Retry it from Live Queue, or visit the front desk.', link: 'queue' }, { pop: false }); audit('failed.notify', j.order); }, { ms: 350, onOk: () => toast({ kind: 'good', msg: j.owner ? 'Owner notified.' : 'This was a guest print, so there is no one to notify. Ask at the front desk.' }) }); };
actions['adm-fail-dismiss'] = el => { const j = jobById(el.dataset.id); j.dismissed = true; audit('failed.dismiss', j.order); admRefresh(); toast({ kind: 'info', msg: `${j.order} dismissed.`, action: { label: 'Undo', fn: () => { j.dismissed = false; admRefresh(); } } }); };

/* ----- analytics ----- */
function admAnalytics() {
  const n = ui.admDays, days = statDays(n), t = days.map(d => d.t), jobs = days.reduce((a, d) => a + d.jobs, 0), pages = days.reduce((a, d) => a + d.pages, 0), col = days.reduce((a, d) => a + d.color, 0), failed = days.reduce((a, d) => a + d.failed, 0);
  const top = S.users.filter(u => u.role !== 'admin').slice().sort((a, b) => b.pagesMonth - a.pagesMonth).slice(0, 6), mx = Math.max(...top.map(u => u.pagesMonth), 1);
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `<div class="row between wrap"><div class="seg sm" role="group" aria-label="Range">${[7, 14].map(v => `<button class="${n === v ? 'on' : ''}" aria-pressed="${n === v}" data-act="adm-range" data-v="${v}">${v} days</button>`).join('')}</div></div>
  <section class="kpis"><div class="kpi"><span class="kpi-ic">${ic('queue')}</span><div><small>Jobs</small><b>${jobs.toLocaleString('en')}</b><em>${(jobs / n).toFixed(0)} per day</em></div></div><div class="kpi"><span class="kpi-ic">${ic('file')}</span><div><small>Pages</small><b>${pages.toLocaleString('en')}</b><em>${pct(col, pages)}% in colour</em></div></div><div class="kpi ${failed / Math.max(jobs, 1) > .04 ? 'warn' : ''}"><span class="kpi-ic">${ic('alert')}</span><div><small>Failure rate</small><b>${(failed / Math.max(jobs, 1) * 100).toFixed(1)}%</b><em>${plural(failed, 'failed job')}</em></div></div><div class="kpi"><span class="kpi-ic">${ic('clock')}</span><div><small>Avg wait</small><b>${Math.round(days.reduce((a, d) => a + d.wait, 0) / n)} min</b><em>across the period</em></div></div></section>
  <div class="grid-2"><section class="card"><h2 class="sec-h">Jobs per day</h2>${barsSVG(days.map(d => d.jobs), t, { label: `Jobs per day, last ${n} days` })}</section>
  <section class="card"><h2 class="sec-h">Pages: grayscale and colour</h2>${stackSVG(days.map(d => d.mono), days.map(d => d.color), t, `Pages per day split by grayscale and colour, last ${n} days`)}<div class="legend row"><span><i class="lg-mono"></i>Grayscale</span><span><i class="lg-col"></i>Colour</span></div></section>
  <section class="card"><h2 class="sec-h">Average wait <small class="muted">minutes</small></h2>${lineSVG(days.map(d => d.wait), t, `Average wait in minutes, last ${n} days`, ' min')}</section>
  <section class="card"><h2 class="sec-h">Top users <small class="muted">pages this month</small></h2><ul class="hbars">${top.map(u => `<li><span>${esc(u.name)}</span><div class="hb"><i style="width:${u.pagesMonth / mx * 100}%"></i></div><b>${u.pagesMonth.toLocaleString('en')}</b></li>`).join('')}</ul></section></div>
  <section class="card"><h2 class="sec-h">Busiest hours <small class="muted">darker is busier</small></h2><div class="heat" role="img" aria-label="Heatmap of print activity by weekday and hour. Busiest around 10 to 12 and 3 to 5 PM. Fridays are closed."><div class="heat-h"><span></span>${Array.from({ length: 14 }, (_, i) => `<small>${i % 2 === 0 ? (i + 8 > 12 ? i + 8 - 12 : i + 8) + (i + 8 >= 12 ? 'p' : 'a') : ''}</small>`).join('')}</div>${S.stats.heat.map((r, w) => `<div class="heat-r ${w === 5 ? 'closed' : ''}"><span>${dn[w]}</span>${r.map((v, h) => `<i style="--v:${v.toFixed(2)}" title="${dn[w]} ${h + 8}:00, ${Math.round(v * 40)} jobs"></i>`).join('')}</div>`).join('')}</div></section>`;
}
actions['adm-range'] = el => { ui.admDays = +el.dataset.v; refresh('admBody'); };

LIVE.admin = ['admKpis', 'admPrinters', 'admQueueMini', 'admQueueTable', 'admPrinterCards'];
