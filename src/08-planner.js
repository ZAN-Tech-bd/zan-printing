/* =====================================================================
   08 Print Planner + ZeroClaw WhatsApp simulator
   ===================================================================== */
const myTasks = () => S.jobs.filter(j => j.owner === S.session.uid && j.status === 'Scheduled').sort(bySeq);
VIEW_RENDER.planner = () => {
  return `${pageHead('Print Planner', 'Line up prints for the days you need them. ZeroClaw reminds you on WhatsApp.', `<button class="btn primary" data-act="task-new">${ic('plus')}New task</button>`)}
  <div class="planner"><div class="pl-main">${reg('plannerWeek')}${reg('plannerList')}</div>
  <aside class="pl-side">${reg('plannerNext')}${reg('plannerWa')}</aside></div>`;
};
REGIONS.plannerWeek = () => {
  const tasks = myTasks(), days = Array.from({ length: 7 }, (_, i) => S.now + i * DAY);
  return `<div class="week" role="group" aria-label="Filter by day"><button class="day all ${ui.plannerDay === 'all' ? 'on' : ''}" aria-pressed="${ui.plannerDay === 'all'}" data-act="pl-day" data-v="all"><b>All</b><small>${tasks.length}</small></button>${days.map(d => { const k = dayKey(d), n = tasks.filter(t => dayKey(t.scheduled) === k).length, cl = labClosed(d); return `<button class="day ${ui.plannerDay === k ? 'on' : ''} ${cl ? 'closed' : ''}" aria-pressed="${ui.plannerDay === k}" data-act="pl-day" data-v="${k}" aria-label="${fmtDateLong(d)}${cl ? ', lab closed' : ''}, ${plural(n, 'task')}"><small>${_f('wd', 'en-GB', { weekday: 'short' }).format(d)}</small><b>${_f('dn', 'en-GB', { day: 'numeric' }).format(d)}</b><span class="dots">${n ? Array.from({ length: Math.min(n, 3) }, () => '<i></i>').join('') : (cl ? '<em>Closed</em>' : '')}</span></button>`; }).join('')}</div>`;
};
actions['pl-day'] = el => { ui.plannerDay = el.dataset.v; refresh('plannerWeek', 'plannerList'); };
function reminderSummary(j, u) {
  if (!u.wa.connected) return `<span class="rem off">${ic('chat')}WhatsApp is off</span>`;
  const offs = [0, 1, 2].filter(o => j.rem[o]); if (!offs.length) return `<span class="rem off">${ic('chat')}No reminders</span>`;
  return offs.map(o => { const t = reminderTime(j, o, u), st = j.remSent[o]; return `<span class="rem ${st === 'skipped' ? 'skip' : st ? 'sent' : ''}" title="${['On the day', '1 day before', '2 days before'][o]}">${ic(st && st !== 'skipped' ? 'check' : 'chat')}${['Day of', '1 day before', '2 days before'][o]} · ${st === 'skipped' ? 'skipped' : (st ? 'sent ' : '') + fmtTime(t) + (dayDiff(t) !== 0 ? ' ' + fmtDate(t) : '')}</span>`; }).join('');
}
function taskCard(j, idx, n) {
  const u = me();
  return `<article class="task card" data-id="${j.id}"><div class="task-head"><div class="task-time"><b>${fmtTime(j.scheduled)}</b><code>${j.order}</code></div>${pill(j.status)}
      <div class="row task-mv"><button class="icon-btn sm" data-act="task-move" data-id="${j.id}" data-d="-1" aria-label="Move ${j.order} earlier in the day" ${idx === 0 ? 'disabled' : ''}>${ic('up')}</button><button class="icon-btn sm" data-act="task-move" data-id="${j.id}" data-d="1" aria-label="Move ${j.order} later in the day" ${idx === n - 1 ? 'disabled' : ''}>${ic('down')}</button></div></div>
    <ul class="task-files">${j.items.map(i => `<li>${fileTile(i)}<span><b>${esc(i.name)}</b><small>${i.range ? 'Pages ' + esc(i.range) : 'All ' + i.pages + ' pages'} · ${plural(i.copies, 'copy', 'copies')}</small></span></li>`).join('')}</ul>
    <div class="row wrap task-chips">${chip(j.settings.paper)}${chip(j.settings.color === 'color' ? 'Colour' : 'Grayscale', j.settings.color === 'color' ? 'good' : '')}${chip(DUPLEX[j.settings.duplex], '', j.settings.duplex !== 'single' ? 'layers' : '')}${chip(plural(j.sheets, 'sheet'))}</div>
    <div class="row wrap task-rem">${reminderSummary(j, u)}</div>
    ${labClosed(j.scheduled) ? `<div class="notice warn sm">${ic('alert')}<div>Lab is closed on Fridays. Collection starts Saturday.</div></div>` : ''}
    <div class="task-act"><button class="btn sm primary" data-act="task-now" data-id="${j.id}">${ic('printer')}Print now</button><button class="btn sm" data-act="task-edit" data-id="${j.id}">${ic('sliders')}Edit</button><button class="btn sm" data-act="task-postpone" data-id="${j.id}" aria-haspopup="menu">${ic('clock')}Postpone</button><button class="btn sm ghost danger" data-act="task-cancel" data-id="${j.id}">${ic('ban')}Cancel</button></div></article>`;
}
REGIONS.plannerList = () => {
  let tasks = myTasks(); if (!tasks.length) return emptyState({ icon: 'calendar', title: 'Nothing planned yet', body: 'Plan tomorrow\'s class sets now. We\'ll queue them on time and WhatsApp you the day before or the morning of.', cta: `<button class="btn primary" data-act="task-new">${ic('plus')}Plan a print</button>` });
  if (ui.plannerDay !== 'all') tasks = tasks.filter(t => dayKey(t.scheduled) === ui.plannerDay);
  if (!tasks.length) return emptyState({ icon: 'calendar', title: 'Nothing on this day', body: 'Your day is free. Add a task, or pick another day.', cta: `<button class="btn primary" data-act="task-new">${ic('plus')}Add a task</button><button class="btn" data-act="pl-day" data-v="all">Show all</button>` });
  const groups = {}; tasks.forEach(t => (groups[dayKey(t.scheduled)] = groups[dayKey(t.scheduled)] || []).push(t));
  return Object.entries(groups).map(([k, l]) => `<section class="day-group"><h2 class="day-h">${relDay(l[0].scheduled)}<small>${fmtDate(l[0].scheduled)} · ${plural(l.length, 'task')}</small></h2><div class="stack">${l.map((t, i) => taskCard(t, i, l.length)).join('')}</div></section>`).join('');
};
REGIONS.plannerNext = () => {
  const u = me(), c = myTasks().map(j => { const r = nextReminderFor(j, u); return r ? { j, ...r } : null; }).filter(Boolean).sort((a, b) => a.t - b.t)[0];
  if (!u.wa.connected) return '';
  if (!c) return `<div class="card side-c"><h3 class="card-h sm">Next reminder</h3><p class="muted">No reminders waiting. New tasks use your default: on the day.</p></div>`;
  const covers = myTasks().filter(j => j.rem[c.off] && !j.remSent[c.off] && dayKey(j.scheduled) === dayKey(c.j.scheduled) && reminderTime(j, c.off, u) === c.t).length;
  return `<div class="card side-c"><h3 class="card-h sm">Next reminder</h3><div class="next-rem"><b>${fmtDate(c.t)}, ${fmtTime(c.t)}</b><span class="chip">in ${fmtEta(Math.max(0, (c.t - S.now) / 1000)).replace('~', '')}</span></div><p class="muted sm">One WhatsApp message covering ${plural(covers, 'task')} for ${fmtDate(c.j.scheduled)}.</p><button class="btn sm ghost" data-act="demo-jump" data-ms="${Math.max(1, c.t - S.now - 2 * MIN)}">${ic('zap')}Fast-forward to it (prototype)</button></div>`;
};
REGIONS.plannerWa = () => {
  const u = me(), w = u.wa;
  return `<div class="card side-c wa-card"><div class="row between"><h3 class="card-h sm">${ic('chat')}ZeroClaw on WhatsApp</h3><span class="chip ${w.connected ? 'good' : 'warn'}">${w.connected ? 'Connected' : 'Off'}</span></div>
  <p class="muted sm">${w.connected ? `Reminders go to <b>${esc(u.phone)}</b> at ${fmtTime(atTime(S.now, w.time))} (${w.lang === 'bn' ? 'বাংলা' : 'English'}).` : 'Turn it on to get reminders and print from your phone.'}</p>
  <div class="cmds"><code>PRINT ZP-4832</code><code>POSTPONE ZP-4832 1D</code><code>CANCEL ZP-4832</code><code>LIST</code></div>
  <div class="row wrap"><button class="btn sm primary" data-act="open-wa">${ic('chat')}Open chat</button><button class="btn sm" data-act="open-settings">${ic('cog')}Reminder settings</button></div></div>`;
};
afterRender.planner = () => { };

/* ----- row actions ----- */
const afterPlan = () => { refresh('plannerWeek', 'plannerList', 'plannerNext', 'sideNav', 'tabBar'); };
actions['task-new'] = () => openTaskEditor(null, []);
actions['task-edit'] = el => openTaskEditor(jobById(el.dataset.id), []);
actions['task-now'] = el => { const j = jobById(el.dataset.id); run('Print now', () => opPrintNow(j), { btn: el, ms: 380, onOk: () => { afterPlan(); onSimChange(); const p = queuePos(j); toast({ kind: 'good', msg: `${j.order} is in the queue${p ? ' at #' + p : ''}.`, action: { label: 'View queue', fn: () => go('queue') } }); } }); };
actions['task-cancel'] = el => {
  const j = jobById(el.dataset.id);
  confirmDialog({ title: `Cancel ${j.order}?`, danger: true, confirm: 'Cancel task', cancel: 'Keep task', body: `<p>${esc(jobTitle(j))} was planned for ${fmtWhen(j.scheduled)}. Its reminders will not be sent.</p>`, onConfirm: () => { const was = j.scheduled; run('Cancel task', () => opCancel(j), { onOk: () => { afterPlan(); toast({ kind: 'info', msg: `${j.order} cancelled.`, action: { label: 'Undo', fn: () => { j.status = 'Scheduled'; j.events.push({ t: S.now, text: 'Restored' }); audit('planner.restore', j.order); afterPlan(); } } }); } }); } });
};
actions['task-move'] = el => {
  const j = jobById(el.dataset.id), k = dayKey(j.scheduled), day = myTasks().filter(t => dayKey(t.scheduled) === k), i = day.indexOf(j), o = day[i + +el.dataset.d]; if (!o) return;
  [j.scheduled, o.scheduled] = [o.scheduled, j.scheduled]; [j.seq, o.seq] = [o.seq, j.seq]; j.remSent = {}; o.remSent = {}; markSkippedReminders(j); markSkippedReminders(o);
  audit('planner.reorder', j.order, { detail: `Swapped with ${o.order}` }); afterPlan();
  const b = $(`[data-act="task-move"][data-id="${j.id}"][data-d="${el.dataset.d}"]`); if (b && !b.disabled) b.focus();
  toast({ kind: 'info', msg: `${j.order} now prints at ${fmtTime(j.scheduled)}, ${o.order} at ${fmtTime(o.scheduled)}.`, ttl: 3400 });
};
actions['task-postpone'] = el => {
  const j = jobById(el.dataset.id), at = d => { const t = j.scheduled + d * DAY; return { ts: t, l: `${fmtDate(t)}, ${fmtTime(t)}${labClosed(t) ? ' (lab closed)' : ''}` }; };
  let sat = j.scheduled + DAY; while (dow(sat) !== 6) sat += DAY;
  openMenu(el, [{ label: '1 day later', hint: at(1).l, icon: 'clock', act: 'post-do', data: { id: j.id, ts: at(1).ts } }, { label: '2 days later', hint: at(2).l, icon: 'clock', act: 'post-do', data: { id: j.id, ts: at(2).ts } }, { label: 'Next Saturday', hint: fmtDate(sat) + ', ' + fmtTime(sat), icon: 'calendar', act: 'post-do', data: { id: j.id, ts: sat } }, { sep: 1 }, { label: 'Pick date and time…', icon: 'sliders', act: 'task-edit', data: { id: j.id } }], { title: 'Postpone ' + j.order });
};
actions['post-do'] = el => { const j = jobById(el.dataset.id), old = j.scheduled, ts = +el.dataset.ts; run('Postpone', () => opPostpone(j, ts), { ms: 320, onOk: () => { afterPlan(); toast({ kind: 'good', msg: `${j.order} moved to ${fmtWhen(ts)}`, action: { label: 'Undo', fn: () => { opPostpone(j, old); afterPlan(); } } }); } }); };

/* ----- task editor ----- */
function openTaskEditor(job, files) {
  const u = me();
  if (job) ui.taskEdit = { id: job.id, items: job.items.map(i => ({ ...i, uid: uid('t') })), settings: { ...job.settings }, date: dayKey(job.scheduled), time: timeInput(job.scheduled), rem: { ...job.rem }, notifyWa: job.notifyWa };
  else { let d = ui.plannerDay !== 'all' && ui.plannerDay >= dayKey(S.now) ? fromInputs(ui.plannerDay, '09:00') : nextOpen(atTime(S.now + DAY, '09:00')); ui.taskEdit = { id: null, items: files.map(f => ({ ...itemFromFile(f), uid: uid('t') })), settings: { ...u.prefs.last }, date: dayKey(d), time: '09:00', rem: { ...u.prefs.defRem }, notifyWa: u.wa.connected }; }
  openOverlay({ id: 'task', kind: 'sheet', wide: true, title: job ? `Edit ${job.order}` : 'New print task', sub: job ? '' : 'Pick files, set when, and choose reminders.', render: taskRender });
}
const teTs = () => { const t = ui.taskEdit; return t.date ? fromInputs(t.date, t.time || '09:00') : NaN; };
function taskIssues() {
  const t = ui.taskEdit, out = []; if (!t.items.length) out.push('Add at least one file.');
  t.items.forEach(i => { if (!parseRange(i.range, i.pages).ok) out.push(`Fix the page range for ${i.name}.`); });
  const ts = teTs(); if (isNaN(ts)) out.push('Choose a date.'); else if (ts <= S.now + MIN) out.push('Choose a time in the future.');
  return out;
}
function taskRender() {
  const t = ui.taskEdit, u = me(), ts = teTs(), issues = taskIssues(), tot = totals(t.items, t.settings);
  const offs = [0, 1, 2].filter(o => t.rem[o]);
  const tmp = { owner: u.id, scheduled: ts, rem: t.rem, order: t.id ? jobById(t.id).order : 'ZP-' + S.counters.order, items: t.items, seq: 0 };
  const firstOff = offs.map(o => ({ o, at: reminderTime(tmp, o, u) })).sort((a, b) => a.at - b.at)[0];
  const msg = !isNaN(ts) && u.wa.connected && firstOff ? formatDigest(u, firstOff.o, [tmp]) : '';
  const q = (l, x) => `<button class="chip btnchip ${teTs() === x ? 'on' : ''}" data-act="te-quick" data-t="${x}">${l}</button>`;
  const tom = nextOpen(atTime(S.now + DAY, '09:00')), eve = atTime(S.now, '18:30');
  return {
    body: `<section class="te-sec"><div class="row between"><h3>Files, in print order</h3><button class="btn sm" data-act="te-add">${ic('folder')}Add from My Files</button></div>
    ${t.items.length ? `<ul class="te-files">${t.items.map((i, k) => { const r = parseRange(i.range, i.pages); return `<li>${fileTile(i)}<div class="te-b"><b>${esc(i.name)}</b><div class="te-ctl"><label class="lbl" for="trng-${i.uid}">Pages</label><input id="trng-${i.uid}" class="input sm ${r.ok ? '' : 'invalid'}" data-in="trange" data-uid="${i.uid}" value="${esc(i.range)}" placeholder="All ${i.pages}" aria-invalid="${!r.ok}"/><label class="lbl" for="tcp-${i.uid}">Copies</label><input id="tcp-${i.uid}" class="input sm num" type="number" min="1" max="500" value="${i.copies}" data-in="tcopies" data-uid="${i.uid}"/></div>${r.ok ? '' : `<small class="bad-t">${esc(r.err)}</small>`}</div><div class="row"><button class="icon-btn sm" data-act="te-move" data-uid="${i.uid}" data-d="-1" ${k === 0 ? 'disabled' : ''} aria-label="Move earlier">${ic('up')}</button><button class="icon-btn sm" data-act="te-move" data-uid="${i.uid}" data-d="1" ${k === t.items.length - 1 ? 'disabled' : ''} aria-label="Move later">${ic('down')}</button><button class="icon-btn sm" data-act="te-remove" data-uid="${i.uid}" aria-label="Remove ${esc(i.name)}">${ic('x')}</button></div></li>`; }).join('')}</ul>` : `<div class="dropzone slim" data-act="te-add" role="button" tabindex="0">${ic('folder')}<span>Choose files from My Files</span></div>`}
    <p class="muted sm">Need a new file? Add it in Print Studio and choose Schedule. It will be saved and protected until printed.</p></section>
    <section class="te-sec"><h3>When</h3><div class="row wrap">${eve > S.now + 5 * MIN ? q('Today 6:30 PM', eve) : ''}${q(`${relDay(tom)} 9:00 AM`, tom)}</div>
      <div class="grid2"><div class="field"><label class="lbl" for="te-date">Date</label><input id="te-date" class="input" type="date" min="${dayKey(S.now)}" value="${t.date}" data-in="tedate"/></div><div class="field"><label class="lbl" for="te-time">Time</label><input id="te-time" class="input" type="time" value="${t.time}" data-in="tetime"/></div></div>
      ${!isNaN(ts) && labClosed(ts) ? `<div class="notice warn">${ic('alert')}<div>The lab is closed on Fridays. It will print, but you can collect it from Saturday.</div></div>` : ''}</section>
    <section class="te-sec"><h3>Settings</h3>${settingsForm('task')}</section>
    <section class="te-sec"><h3>WhatsApp reminders</h3>${u.wa.connected ? `${remChips2(t.rem, 'te')}<p class="muted sm">Default is the morning of the day. Each message lists the filenames, the order ID and the commands to reply with.</p>
      ${msg ? `<div class="wa-prev" aria-label="Preview of the first reminder"><small class="muted">Preview · sends ${fmtDate(firstOff.at)}, ${fmtTime(firstOff.at)}${firstOff.at <= S.now ? ' (already passed, will be skipped)' : ''}</small><div class="bubble in">${waFmt(msg)}</div></div>` : offs.length ? '' : '<p class="muted sm">No reminders will be sent for this task.</p>'}
      <div class="set-row"><div><b>Also message me when it's ready</b><small>Pickup shelf and code.</small></div>${sw(t.notifyWa, 'te-wa', '', 'Message me when ready')}</div>` : `<div class="notice info">${ic('info')}<div>WhatsApp isn't connected. <button class="link" data-act="open-settings">Connect it in Settings</button> to receive reminders.</div></div>`}</section>`,
    foot: `<div class="te-sum">${tot.pages ? `${plural(tot.pages, 'page')} · ${plural(tot.sheets, 'sheet')}` : ''}${issues.length ? `<small class="warn-t">${esc(issues[0])}</small>` : ''}</div><button class="btn ghost" data-act="ov-close" data-id="task">Cancel</button><button class="btn primary" id="teSave" data-act="te-save" ${issues.length ? 'disabled' : ''}>${ic('check')}${t.id ? 'Save changes' : 'Create task'}</button>`
  };
}
inputs.trange = el => { const i = ui.taskEdit.items.find(x => x.uid === el.dataset.uid); i.range = el.value; const r = parseRange(i.range, i.pages); el.classList.toggle('invalid', !r.ok); if (!r.ok !== (el.getAttribute('aria-invalid') === 'true') || true) refreshOverlay('task'); };
inputs.tcopies = (el, e) => { const i = ui.taskEdit.items.find(x => x.uid === el.dataset.uid), v = parseInt(el.value, 10); if (!isNaN(v)) i.copies = clamp(v, 1, 500); if (e.type === 'change') refreshOverlay('task'); };
inputs.tedate = el => { ui.taskEdit.date = el.value; refreshOverlay('task'); };
inputs.tetime = (el, e) => { ui.taskEdit.time = el.value; if (e.type === 'change') refreshOverlay('task'); };
actions['te-quick'] = el => { const t = +el.dataset.t; ui.taskEdit.date = dayKey(t); ui.taskEdit.time = timeInput(t); refreshOverlay('task'); };
actions['te-wa'] = () => { ui.taskEdit.notifyWa = !ui.taskEdit.notifyWa; refreshOverlay('task'); };
actions['te-move'] = el => { const a = ui.taskEdit.items, i = a.findIndex(x => x.uid === el.dataset.uid), j = i + +el.dataset.d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]]; refreshOverlay('task'); };
actions['te-remove'] = el => { ui.taskEdit.items = ui.taskEdit.items.filter(x => x.uid !== el.dataset.uid); refreshOverlay('task'); };
actions['te-add'] = () => openFilePicker(fs => { fs.forEach(f => ui.taskEdit.items.push({ ...itemFromFile(f), uid: uid('t') })); refreshOverlay('task'); }, ui.taskEdit.items.map(i => i.fileId).filter(Boolean));
actions['te-save'] = el => {
  const t = ui.taskEdit, u = me(), ts = teTs();
  run(t.id ? 'Save changes' : 'Create task', () => {
    const items = t.items.map(i => ({ fileId: i.fileId, name: i.name, pages: i.pages, range: i.range, copies: i.copies, ext: i.ext, kind: i.kind, hue: i.hue }));
    if (t.id) {
      const j = jobById(t.id), tt = totals(items, t.settings), moved = j.scheduled !== ts;
      Object.assign(j, { items, settings: { ...t.settings }, pages: tt.pages, impressions: tt.impressions, sheets: tt.sheets, scheduled: ts, rem: { ...t.rem }, notifyWa: t.notifyWa });
      j.remSent = {}; markSkippedReminders(j); ev(j, 'Edited' + (moved ? `, now ${fmtWhen(ts)}` : '')); audit('planner.edit', j.order, { detail: `${fmtWhen(ts)}, ${plural(items.length, 'file')}` }); return j;
    }
    const j = createJob({ owner: u.id, items, settings: t.settings, scheduled: ts, rem: t.rem, notifyWa: t.notifyWa });
    audit('planner.create', j.order, { detail: fmtWhen(ts) }); u.prefs.last = { ...t.settings }; return j;
  }, { btn: el, onOk: j => { closeOverlay('task'); afterPlan(); toast({ kind: 'good', msg: t.id ? `${j.order} updated.` : `${j.order} planned for ${fmtWhen(ts)}.` }); if (ui.view !== 'planner') go('planner'); } });
};

/* ----- WhatsApp simulator ----- */
function scrollWa() { const m = $('.wa-msgs'); if (m) m.scrollTop = m.scrollHeight; }
actions['open-wa'] = () => {
  const u = me(); S.waUnread = 0; refresh('waBtn'); ui.waOpen = true;
  openOverlay({
    id: 'wa', kind: 'drawer', title: 'WhatsApp · ZeroClaw', sub: u.wa.connected ? `Chatting with ${u.phone} (simulated)` : 'Not connected. Messages will not be delivered.', onClose: () => { ui.waOpen = false; }, render: () => ({
      body: `<div class="wa"><div class="wa-msgs" data-region="waChat" role="log" aria-live="polite" aria-label="Chat with ZeroClaw">${REGIONS.waChat()}</div>
      <div class="wa-quick" data-region="waQuick">${REGIONS.waQuick()}</div>
      <form class="wa-form" id="waForm"><label class="sr" for="wa-in">Message</label><input id="wa-in" class="input" placeholder="Type a command, e.g. LIST" autocomplete="off" ${u.wa.connected ? '' : 'disabled'}/><button class="btn primary icon" type="submit" aria-label="Send" ${u.wa.connected ? '' : 'disabled'}>${ic('send')}</button></form></div>`
    })
  });
  setTimeout(scrollWa, 30);
};
REGIONS.waChat = () => {
  const u = me(); if (!u) return ''; const ms = S.wa[u.id] || []; let last = '';
  if (!ms.length) return `<div class="wa-empty">${ic('chat')}<p>No messages yet. Plan a task and ZeroClaw will message you here, or send <code>HELP</code>.</p></div>`;
  return ms.map(m => { const d = relDay(m.t); const sep = d !== last ? `<div class="wa-day"><span>${d}</span></div>` : ''; last = d; return `${sep}<div class="bubble ${m.from === 'bot' ? 'in' : 'out'}">${waFmt(m.text)}<em>${fmtTime(m.t)}${m.from === 'user' ? ic('check') : ''}</em></div>`; }).join('') + (ui.waTyping ? '<div class="bubble in typing" aria-label="ZeroClaw is typing"><i></i><i></i><i></i></div>' : '');
};
REGIONS.waQuick = () => {
  const u = me(); if (!u) return ''; const ms = S.wa[u.id] || [], lastBot = [...ms].reverse().find(m => m.from === 'bot');
  const found = lastBot ? [...lastBot.text.matchAll(/`([A-Z]+(?: [A-Z0-9-]+)+)`/g)].map(x => x[1]).filter(c => !/^(COLLECTED|HELP)/.test(c)).slice(0, 4) : [];
  const base = found.length ? found : ['LIST', 'STATUS', 'HELP'];
  return base.map(c => `<button class="chip btnchip" data-act="wa-quick" data-t="${esc(c)}">${esc(c)}</button>`).join('');
};
actions['wa-quick'] = el => { if (!me().wa.connected) return; waReceive(me(), el.dataset.t); };
document.addEventListener('submit', e => { if (e.target.id === 'waForm') { e.preventDefault(); const i = $('#wa-in'), v = i.value.trim(); if (!v) return; i.value = ''; waReceive(me(), v); } });
