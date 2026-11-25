/* =====================================================================
   03 sim: domain logic, print engine, reminders, ZeroClaw WhatsApp bot
   ===================================================================== */
const userById = id => S.users.find(u => u.id === id);
const me = () => userById(S.session.uid);
const jobById = id => S.jobs.find(j => j.id === id);
const printerById = id => S.printers.find(p => p.id === id);
const fileById = id => S.files.find(f => f.id === id);
const role = () => S.session.role;
const isGuest = () => S.session.role === 'guest';
const isAdmin = () => S.session.role === 'admin';
const isMine = j => isGuest() ? !!(j.guest && j.guest.id === S.session.guestId) : (!!S.session.uid && j.owner === S.session.uid);
const firstName = u => (u.name || '').split(' ')[0];
const labClosed = ms => dow(ms) === 5; // Friday
function ev(job, text) { job.events.push({ t: S.now, text }); }
function sessionIp() { return S.session.ip || (demo.net === 'lan' ? '192.168.10.44' : '103.88.21.9'); }

/* ---------- audit + notifications ---------- */
function audit(action, target = '', o = {}) {
  const sess = S.session, u = me();
  S.audit.unshift({ id: uid('a'), t: S.now, actor: o.actor ?? (u ? u.name : sess.role === 'guest' ? 'Guest ' + sessionIp() : 'Anonymous'), role: o.role ?? (sess.role || 'anon'), action, target, result: o.result || 'success', detail: o.detail || '', net: o.net ?? demo.net, ip: o.ip ?? sessionIp() });
  if (S.audit.length > 500) S.audit.length = 500;
}
function notify(userId, n, { pop = true } = {}) {
  if (!userId) return;
  S.notifs.unshift({ id: uid('n'), uid: userId, t: S.now, read: false, ...n });
  if (userId === S.session.uid) { refresh('bell'); if (pop) toast({ kind: n.type === 'failed' ? 'bad' : 'good', msg: n.title, action: n.link ? { label: 'View', fn: () => go(n.link) } : null, ttl: 6000 }); }
}

/* ---------- ranges & totals ---------- */
function parseRange(str, max) {
  str = (str || '').trim();
  if (!str || /^all$/i.test(str)) return { ok: true, all: true, pages: Array.from({ length: max }, (_, i) => i + 1) };
  const set = new Set();
  for (const part of str.split(',')) {
    const p = part.trim(); if (!p) continue;
    const m = p.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) return { ok: false, err: `"${p}" isn't a valid range. Try 1-3, 5.` };
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b < 1) return { ok: false, err: 'Pages start at 1.' };
    if (b < a) return { ok: false, err: `${a}-${b} runs backwards.` };
    if (b > max) return { ok: false, err: `Page ${b} is past the last page (${max}).` };
    for (let i = a; i <= b; i++) set.add(i);
  }
  if (!set.size) return { ok: false, err: 'Enter at least one page.' };
  return { ok: true, pages: [...set].sort((x, y) => x - y) };
}
const itemPageCount = it => { const r = parseRange(it.range, it.pages); return r.ok ? r.pages.length : 0; };
function totals(items, st) {
  let pages = 0, impressions = 0, sheets = 0; const per = st.duplex !== 'single' ? 2 : 1;
  for (const it of items) { const n = itemPageCount(it); pages += n; impressions += n * it.copies; sheets += Math.ceil(n / per) * it.copies; }
  return { pages, impressions, sheets };
}
function settingsLine(st) { return `${st.paper} · ${st.color === 'color' ? 'Colour' : 'Grayscale'} · ${DUPLEX[st.duplex]}${st.orient !== 'auto' ? ' · ' + (st.orient === 'landscape' ? 'Landscape' : 'Portrait') : ''}`; }
const jobTitle = j => j.items.length === 1 ? j.items[0].name : `${j.items[0].name} +${j.items.length - 1} more`;

/* ---------- printers: capability, routing, ETA ---------- */
function printerIssues(p, st) {
  const r = [];
  if (st.color === 'color' && !p.caps.color) r.push('prints in grayscale only');
  if (!p.caps.paper.includes(st.paper)) r.push(`has no ${st.paper} paper`);
  if (st.duplex !== 'single' && !p.caps.duplex) r.push('has no double-sided unit');
  return r;
}
const pStatusLabel = p => ({ online: 'Online', paused: 'Paused', jam: 'Paper jam', offline: 'Offline' }[p.status]);
const printerBusy = p => S.jobs.some(j => j.printer === p.id && j.status === 'Printing');
const printerOk = p => p.status === 'online';
function remainingSec(job, p) { return Math.max(0, job.impressions - job.done) / (p.ppm / 60); }
function backlogSec(p, beforeKey = Infinity, exceptId = null) {
  let s = 0;
  for (const j of S.jobs) { if (j.printer !== p.id || j.id === exceptId) continue; if (j.status === 'Printing' || (j.status === 'Queued' && j.qkey < beforeKey)) s += remainingSec(j, p); }
  return s + Math.max(0, p.warm);
}
function jobEtaSec(job) {
  const p = printerById(job.printer); if (!p || !printerOk(p)) return null;
  if (job.status === 'Printing') return remainingSec(job, p) + Math.max(0, p.warm);
  if (job.status === 'Queued') return backlogSec(p, job.qkey, job.id) + remainingSec(job, p) + (p.idle ? 8 : 0);
  return null;
}
function queuePos(job) { if (job.status !== 'Queued') return null; return S.jobs.filter(j => j.printer === job.printer && (j.status === 'Printing' || (j.status === 'Queued' && j.qkey < job.qkey))).length + 1; }
const printerWaitSec = p => printerOk(p) ? backlogSec(p) + (p.idle ? 8 : 0) : null;
function routePrinter(job, exclude = null) {
  const st = job.settings, can = S.printers.filter(p => !printerIssues(p, st).length && p.id !== exclude);
  if (job.printerPref && job.printerPref !== 'auto') { const p = printerById(job.printerPref); if (p && !printerIssues(p, st).length && p.id !== exclude) return p; }
  const up = can.filter(printerOk), pool = up.length ? up : can; if (!pool.length) return null;
  const score = p => backlogSec(p) + (st.color === 'bw' && p.caps.color ? 45 : 0) + (p.paper < 10 ? 30 : 0);
  return pool.slice().sort((a, b) => score(a) - score(b))[0];
}

/* ---------- job lifecycle ---------- */
function createJob(o) {
  const items = o.items.map(i => ({ fileId: i.fileId || null, name: i.name, pages: i.pages, range: i.range || '', copies: i.copies || 1, ext: i.ext, kind: i.kind, hue: i.hue }));
  const t = totals(items, o.settings), order = 'ZP-' + (S.counters.order++);
  const job = { id: uid('j'), order, owner: o.owner || null, guest: o.guest || null, status: 'Scheduled', printer: null, printerPref: o.printerPref || 'auto', items, settings: { ...o.settings }, pages: t.pages, impressions: t.impressions, sheets: t.sheets, done: 0, created: S.now, scheduled: o.scheduled || null, seq: ++S.counters.seq, qkey: null, queuedAt: null, startedAt: null, readyAt: null, collectedAt: null, fail: null, code: String(1000 + Math.floor(Math.random() * 9000)), shelf: null, rem: { ...(o.rem || { 0: true, 1: false, 2: false }) }, remSent: {}, notifyWa: !!o.notifyWa, source: o.source || 'web', save: o.save !== false, events: [{ t: S.now, text: o.scheduled ? `Scheduled for ${fmtWhen(o.scheduled)}` : 'Submitted' }] };
  S.jobs.push(job);
  if (o.scheduled) markSkippedReminders(job); else queueJob(job);
  return job;
}
function queueJob(job) {
  job.status = 'Queued'; job.queuedAt = S.now; job.qkey = S.now + job.seq / 1000;
  const p = routePrinter(job); job.printer = p ? p.id : null;
  ev(job, p ? `Queued on ${p.name}` : 'Queued: waiting for a compatible printer');
}
function rerouteFrom(p) {
  S.jobs.filter(j => j.status === 'Queued' && j.printer === p.id).forEach(j => {
    const alt = routePrinter(j, p.id);
    if (alt && printerOk(alt)) { j.printer = alt.id; ev(j, `Rerouted to ${alt.name} (${p.name} unavailable)`); }
  });
}
function nextShelf() {
  const used = new Set(S.jobs.filter(j => j.status === 'Ready for Collection').map(j => j.shelf));
  for (const r of ['A', 'B', 'C']) for (let i = 1; i <= 6; i++) if (!used.has(r + '-' + i)) return r + '-' + i;
  return 'D-1';
}
function consume(p, used, st) {
  p.pages += used;
  p.ink.K = Math.max(0, p.ink.K - used * 0.0014);
  if (st.color === 'color' && p.caps.color) ['C', 'M', 'Y'].forEach(k => { if (p.ink[k] != null) p.ink[k] = Math.max(0, p.ink[k] - used * 0.002); });
  p.paper = Math.max(2, p.paper - used / (st.duplex !== 'single' ? 2 : 1) * 0.05);
}
function finishJob(job, p) {
  job.done = job.impressions; job.status = 'Ready for Collection'; job.readyAt = S.now; job.shelf = nextShelf();
  ev(job, `Ready for collection at shelf ${job.shelf}`);
  audit('job.ready', job.order, { actor: 'System', role: 'system', detail: `${p.name} · shelf ${job.shelf}` });
  if (job.owner) {
    notify(job.owner, { type: 'ready', title: `${job.order} is ready for collection`, body: `${jobTitle(job)} is waiting on shelf ${job.shelf}. Pickup code ${job.code}.`, link: 'queue' });
    const u = userById(job.owner);
    if (job.notifyWa && u && u.wa.connected) waBot(u.id, formatReady(job, u));
  }
}
function failJob(job, reason, code) {
  job.status = 'Failed'; job.fail = { reason, code, at: S.now }; ev(job, 'Failed: ' + reason);
  audit('job.fail', job.order, { actor: 'System', role: 'system', result: 'failed', detail: `${reason} (${code})` });
  if (job.owner) {
    notify(job.owner, { type: 'failed', title: `${job.order} failed`, body: reason + '. Retry from the queue.', link: 'queue' });
    const u = userById(job.owner); if (job.notifyWa && u && u.wa.connected) waBot(u.id, formatFailed(job, u));
  }
}
function jamPrinter(p, reason = 'Paper jam') {
  const job = S.jobs.find(j => j.status === 'Printing' && j.printer === p.id);
  p.status = 'jam'; p.errors.unshift({ t: S.now, text: `${reason}${job ? ' (job ' + job.order + ')' : ''}` });
  if (job) failJob(job, `${reason} at page ${Math.floor(job.done) + 1} of ${job.impressions}`, 'E-JAM-402');
  rerouteFrom(p);
  audit('printer.error', p.name, { actor: 'System', role: 'system', result: 'failed', detail: reason });
}
function printerAction(p, kind) {
  const label = { pause: 'Paused', resume: 'Resumed', clear: 'Jam cleared', jam: 'Jam simulated', paper: 'Paper refilled', ink: 'Cartridges replaced', offline: 'Taken offline' }[kind];
  if (kind === 'pause') { p.status = 'paused'; rerouteFrom(p); }
  if (kind === 'resume' || kind === 'clear') { p.status = 'online'; p.idle = true; }
  if (kind === 'jam') jamPrinter(p, 'Paper jam (simulated)');
  if (kind === 'offline') { p.status = 'offline'; rerouteFrom(p); }
  if (kind === 'paper') p.paper = 100;
  if (kind === 'ink') Object.keys(p.ink).forEach(k => p.ink[k] = 100);
  if (kind !== 'jam') audit('printer.' + (kind === 'paper' || kind === 'ink' ? 'maintenance' : kind), p.name, { detail: label });
  return label;
}
function opPrintNow(job, o = {}) {
  if (job.status !== 'Scheduled') return false;
  ev(job, `Printed early${o.actor ? ' via ' + o.actor : ''}`); queueJob(job);
  audit('job.print_now', job.order, { actor: o.actor, detail: 'Moved from planner to queue' }); return true;
}
function opCancel(job, o = {}) {
  const ok = job.status === 'Scheduled' || job.status === 'Queued' || (isAdmin() && job.status === 'Printing');
  if (!ok) return false;
  job.status = 'Cancelled'; ev(job, `Cancelled by ${o.actor || (me() ? me().name : 'guest')}`);
  audit('job.cancel', job.order, { actor: o.actor }); return true;
}
function opPostpone(job, ts, o = {}) {
  if (job.status !== 'Scheduled') return false;
  const old = job.scheduled; job.scheduled = ts; job.remSent = {}; markSkippedReminders(job);
  ev(job, `Postponed to ${fmtWhen(ts)}`);
  audit('planner.postpone', job.order, { actor: o.actor, detail: `${fmtWhen(old)} to ${fmtWhen(ts)}` }); return true;
}
function opRetry(job, o = {}) {
  if (job.status !== 'Failed') return false;
  job.fail = null; job.printerPref = o.printer || 'auto'; ev(job, `Retried${job.done ? ' from page ' + (Math.floor(job.done) + 1) : ''}`); queueJob(job);
  audit('job.retry', job.order, { actor: o.actor }); return true;
}
function opCollected(job, o = {}) {
  if (job.status !== 'Ready for Collection') return false;
  job.status = 'Collected'; job.collectedAt = S.now; ev(job, 'Collected'); audit('job.collected', job.order, { actor: o.actor }); return true;
}
function opBump(job) { const min = Math.min(...S.jobs.filter(j => j.status === 'Queued').map(j => j.qkey)); job.qkey = min - 1; ev(job, 'Moved to the front by an admin'); audit('queue.bump', job.order); }

/* ---------- planner reminders (ZeroClaw) ---------- */
function reminderTime(job, off, u) {
  let t = atTime(startOfDay(job.scheduled) - off * DAY, u.wa.time || '08:00');
  if (off === 0) t = Math.min(t, job.scheduled - 30 * MIN);
  return t;
}
function markSkippedReminders(job) {
  const u = userById(job.owner); if (!u) return;
  for (const off of [0, 1, 2]) if (job.rem[off] && !job.remSent[off] && reminderTime(job, off, u) <= S.now) job.remSent[off] = 'skipped';
}
function nextReminderFor(job, u) {
  const c = [0, 1, 2].filter(o => job.rem[o] && !job.remSent[o]).map(o => ({ off: o, t: reminderTime(job, o, u) })).sort((a, b) => a.t - b.t);
  return c[0] || null;
}
function stepReminders() {
  const groups = {};
  for (const j of S.jobs) {
    if (j.status !== 'Scheduled' || !j.owner) continue; const u = userById(j.owner); if (!u || !u.wa.connected) continue;
    for (const off of [0, 1, 2]) if (j.rem[off] && !j.remSent[off] && reminderTime(j, off, u) <= S.now) { const k = `${j.owner}|${off}|${dayKey(j.scheduled)}`; (groups[k] = groups[k] || { u, off, jobs: [] }).jobs.push(j); }
  }
  for (const g of Object.values(groups)) {
    g.jobs.sort(bySeq); waBot(g.u.id, formatDigest(g.u, g.off, g.jobs)); g.jobs.forEach(j => j.remSent[g.off] = S.now);
    audit('reminder.sent', g.u.name, { actor: 'ZeroClaw', role: 'system', detail: `${plural(g.jobs.length, 'task')} · ${['today', 'tomorrow', 'in 2 days'][g.off]}` });
    notify(g.u.id, { type: 'reminder', title: `WhatsApp plan sent for ${['today', 'tomorrow', 'in 2 days'][g.off]}`, body: `ZeroClaw listed ${plural(g.jobs.length, 'task')} with reply commands.`, link: 'planner' }, { pop: false });
  }
}
function stepScheduler() {
  S.jobs.filter(j => j.status === 'Scheduled' && j.scheduled <= S.now).sort(bySeq).forEach(j => {
    queueJob(j); audit('job.start', j.order, { actor: 'System', role: 'system', detail: 'Scheduled time reached' });
    if (j.owner) notify(j.owner, { type: 'info', title: `${j.order} moved to the queue`, body: 'Its scheduled time arrived.', link: 'queue' }, { pop: j.owner === S.session.uid });
  });
}
function stepPrinters(dt) {
  for (const p of S.printers) {
    if (p.status !== 'online') continue;
    let job = S.jobs.find(j => j.status === 'Printing' && j.printer === p.id);
    if (!job) {
      const next = S.jobs.filter(j => j.status === 'Queued' && j.printer === p.id).sort((a, b) => a.qkey - b.qkey)[0];
      if (!next) { p.idle = true; continue; }
      job = next; job.status = 'Printing'; job.startedAt = job.startedAt || S.now; ev(job, `Started printing on ${p.name}`);
      p.warm = p.idle ? 8 : 0; p.idle = false;
    }
    if (p.warm > 0) { p.warm -= dt; continue; }
    const add = p.ppm / 60 * dt, prev = job.done; job.done = Math.min(job.impressions, job.done + add); consume(p, job.done - prev, job.settings);
    if (job.done >= job.impressions - 1e-6) finishJob(job, p);
  }
  // jobs waiting without a printer
  S.jobs.filter(j => j.status === 'Queued' && !j.printer).forEach(j => { const p = routePrinter(j); if (p) { j.printer = p.id; ev(j, `Assigned to ${p.name}`); } });
}
function advance(ms) {
  let left = ms;
  while (left > 0) { const step = Math.min(left, 20000); S.now += step; stepReminders(); stepScheduler(); stepPrinters(step / 1000); left -= step; }
}

/* ---------- files & storage ---------- */
const userFiles = id => S.files.filter(f => f.owner === id);
const usedBytes = u => userFiles(u.id).reduce((a, f) => a + f.size, 0) + (u.usedStatic || 0);
function protectedIds(userId) {
  const ids = new Set();
  S.jobs.forEach(j => { if (j.owner === userId && ['Scheduled', 'Queued', 'Printing'].includes(j.status)) j.items.forEach(i => i.fileId && ids.add(i.fileId)); });
  S.files.forEach(f => { if (f.owner === userId && f.pinned) ids.add(f.id); });
  return ids;
}
function eligibleFiles(u) { const pr = protectedIds(u.id); return userFiles(u.id).filter(f => !pr.has(f.id)).sort((a, b) => a.addedAt - b.addedAt); }
function planEviction(u, need) {
  const short = need - (u.quota - usedBytes(u)); if (short <= 0) return { ok: true, remove: [], short: 0, freed: 0 };
  const elig = eligibleFiles(u), remove = []; let freed = 0;
  for (const f of elig) { if (freed >= short) break; remove.push(f); freed += f.size; }
  return { ok: freed >= short, remove, short, freed };
}
function autoClean(u, plan) {
  const ids = new Set(plan.remove.map(f => f.id));
  S.files = S.files.filter(f => !ids.has(f.id));
  if (plan.remove.length) {
    S.cleaned.unshift({ t: S.now, uid: u.id, files: plan.remove.map(f => f.name), bytes: plan.freed });
    audit('file.autoclean', `${plural(plan.remove.length, 'file')}`, { detail: `Freed ${fmtMB(plan.freed)} MB: ${plan.remove.map(f => f.name).join(', ')}` });
    notify(u.id, { type: 'storage', title: `Removed ${plural(plan.remove.length, 'old file')} to make space`, body: plan.remove.map(f => f.name).join(', '), link: 'files' }, { pop: false });
  }
}
function storeItem(u, it) {
  const f = { id: uid('f'), owner: u.id, name: it.name, ext: it.ext, size: it.size, pages: it.pages, addedAt: S.now, lastPrinted: null, pinned: false, kind: it.kind, hue: it.hue, est: !!it.est, blobUrl: it.blobUrl || null };
  S.files.push(f); it.fileId = f.id; audit('file.upload', f.name, { detail: `${fmtSize(f.size)}, saved to My Files` }); return f;
}
function removeFile(f, o = {}) { S.files = S.files.filter(x => x.id !== f.id); audit('file.delete', f.name, { detail: o.detail || fmtSize(f.size) }); }

/* ---------- ZeroClaw WhatsApp bot ---------- */
function waPush(userId, from, text) { (S.wa[userId] = S.wa[userId] || []).push({ id: uid('m'), from, t: S.now, text }); if (from === 'bot') S.waUnread = (S.waUnread || 0) + (ui.waOpen ? 0 : 1); refresh('waChat', 'waQuick', 'waBtn'); setTimeout(() => typeof scrollWa === 'function' && scrollWa(), 0); }
function waBot(userId, text) { waPush(userId, 'bot', text); }
const firstTitle = j => j.items[0].name + (j.items.length > 1 ? ` +${j.items.length - 1}` : '');
function formatDigest(u, off, jobs) {
  if (!jobs.length) return 'No tasks.';
  const bn = u.wa.lang === 'bn', day = jobs[0].scheduled, n = jobs.length, f = firstName(u);
  const head = bn ? `*ZAN Print Lab* · ${['আজকের', 'আগামীকালের', 'পরশুর'][off]} প্রিন্ট প্ল্যান` : `*ZAN Print Lab* · print plan for ${['today', 'tomorrow', 'in 2 days'][off]}`;
  const intro = bn ? `হ্যালো ${f}, *${fmtDate(day)}* তারিখে আপনার ${n}টি প্রিন্ট টাস্ক আছে:` : `Hi ${f}, you have ${plural(n, 'task')} scheduled for *${fmtDate(day)}*:`;
  const rows = jobs.map((j, i) => `${i + 1}) *${j.order}* · ${fmtTime(j.scheduled)}\n    ${j.items.map(x => x.name).join(', ')}`).join('\n');
  const j0 = jobs[0].order;
  const cmds = bn
    ? `উত্তর দিন:\n\`PRINT ${j0}\` এখনই প্রিন্ট\n\`POSTPONE ${j0} 1D\` ১ দিন পিছিয়ে দিন\n\`CANCEL ${j0}\` বাতিল${off === 0 && n > 1 ? '\n`PRINT ALL` আজকের সব ক্রমানুসারে' : ''}`
    : `Reply with:\n\`PRINT ${j0}\` print now\n\`POSTPONE ${j0} 1D\` move by a day\n\`CANCEL ${j0}\` cancel the task${off === 0 && n > 1 ? '\n`PRINT ALL` print all of today in order' : ''}`;
  return `${head}\n${intro}\n\n${rows}\n\n${cmds}`;
}
function formatReady(job, u) {
  return u.wa.lang === 'bn' ? `*ZAN Print Lab* · *${job.order}* প্রস্তুত! শেলফ *${job.shelf}* থেকে সংগ্রহ করুন। পিকআপ কোড: \`${job.code}\`\nসংগ্রহ হলে \`COLLECTED ${job.order}\` লিখে জানান।`
    : `*ZAN Print Lab* · *${job.order}* is ready for collection.\n${jobTitle(job)}\nShelf *${job.shelf}* · pickup code \`${job.code}\`\nReply \`COLLECTED ${job.order}\` once you have it.`;
}
function formatFailed(job, u) { return `*ZAN Print Lab* · *${job.order}* failed.\n${job.fail.reason}.\nReply \`RETRY ${job.order}\` to print it again.`; }
function waHelp() { return 'ZeroClaw commands:\n`LIST` your upcoming tasks\n`PRINT ZP-1234` print a task now\n`PRINT ALL` print today\'s tasks in order\n`POSTPONE ZP-1234 1D` (also 2D, 1W)\n`CANCEL ZP-1234`\n`STATUS` or `STATUS ZP-1234`\n`COLLECTED ZP-1234`\n`RETRY ZP-1234`'; }
function statusLine(j) {
  const p = printerById(j.printer);
  if (j.status === 'Queued') { const e = jobEtaSec(j); return `*${j.order}* · Queued, #${queuePos(j)} on ${p ? p.name : 'next free printer'}${e != null ? ', ' + fmtEta(e) : ''}`; }
  if (j.status === 'Printing') { const e = jobEtaSec(j); return `*${j.order}* · Printing ${pct(j.done, j.impressions)}%${e != null ? ', ' + fmtEta(e) + ' left' : ''}`; }
  if (j.status === 'Ready for Collection') return `*${j.order}* · Ready on shelf ${j.shelf}, code \`${j.code}\``;
  if (j.status === 'Scheduled') return `*${j.order}* · Scheduled for ${fmtWhen(j.scheduled)}`;
  return `*${j.order}* · ${j.status}`;
}
function waCommand(u, raw) {
  const up = raw.trim().toUpperCase().replace(/\s+/g, ' '); const idm = up.match(/ZP-?\s?(\d{3,5})/); const id = idm ? 'ZP-' + idm[1] : null;
  const verb = up.split(' ')[0].replace(/[^A-Z?]/g, ''); const job = id ? S.jobs.find(j => j.order === id) : null; const mine = job && job.owner === u.id;
  const actor = 'ZeroClaw (WhatsApp)';
  const nf = `I couldn't find *${id}* on your account. Reply \`LIST\` to see your tasks.`;
  const log = (r = 'success') => audit('wa.command', id || verb, { actor: u.name + ' via WhatsApp', role: 'user', result: r, detail: raw.trim().slice(0, 60) });
  if (!up) return waHelp();
  if (['HELP', '?', 'MENU', 'HI', 'HELLO'].includes(verb)) return waHelp();
  if (['LIST', 'TODAY', 'PLAN', 'TASKS'].includes(verb)) {
    const l = S.jobs.filter(j => j.owner === u.id && j.status === 'Scheduled').sort(bySeq).slice(0, 6); log();
    return l.length ? 'Your upcoming tasks:\n' + l.map(j => `*${j.order}* · ${fmtDate(j.scheduled)} ${fmtTime(j.scheduled)}\n    ${firstTitle(j)}`).join('\n') : 'You have no scheduled print tasks. Plan one in the Print Planner.';
  }
  if (verb === 'STATUS') {
    if (id) { if (!mine) return nf; log(); return statusLine(job); }
    const l = S.jobs.filter(j => j.owner === u.id && ['Scheduled', 'Queued', 'Printing', 'Ready for Collection'].includes(j.status)).sort(bySeq).slice(0, 6); log();
    return l.length ? l.map(statusLine).join('\n') : 'Nothing is active on your account right now.';
  }
  if (verb === 'PRINT' && /\bALL\b/.test(up)) {
    const l = S.jobs.filter(j => j.owner === u.id && j.status === 'Scheduled' && dayDiff(j.scheduled) === 0).sort(bySeq);
    if (!l.length) return 'There are no scheduled tasks for today.';
    l.forEach(j => opPrintNow(j, { actor })); log(); return `Queued ${plural(l.length, 'task')} in order:\n` + l.map(statusLine).join('\n');
  }
  if (verb === 'PRINT') {
    if (!id) return 'Which task? Reply like `PRINT ZP-4832`.'; if (!mine) return nf;
    if (job.status !== 'Scheduled') return `*${id}* is ${job.status.toLowerCase()}, so I can't print it again from here.`;
    opPrintNow(job, { actor }); log(); return `Done. ${statusLine(job)}`;
  }
  if (verb === 'POSTPONE') {
    if (!id) return 'Which task? Reply like `POSTPONE ZP-4832 1D`.'; if (!mine) return nf;
    if (job.status !== 'Scheduled') return `*${id}* is already ${job.status.toLowerCase()}.`;
    const m = up.replace(id, '').match(/(\d)\s*([DW])/); const days = m ? +m[1] * (m[2] === 'W' ? 7 : 1) : 1;
    opPostpone(job, job.scheduled + days * DAY, { actor }); log();
    return `Moved *${id}* to ${fmtWhen(job.scheduled)}.${labClosed(job.scheduled) ? '\nNote: the lab is closed on Fridays, so collection starts Saturday.' : ''}`;
  }
  if (verb === 'CANCEL') { if (!id) return 'Which task? Reply like `CANCEL ZP-4832`.'; if (!mine) return nf; if (!opCancel(job, { actor })) return `*${id}* is ${job.status.toLowerCase()} and can't be cancelled.`; log(); return `*${id}* is cancelled.`; }
  if (verb === 'RETRY') { if (!id || !mine) return id ? nf : 'Which job? Reply like `RETRY ZP-4832`.'; if (!opRetry(job, { actor })) return `*${id}* isn't in a failed state.`; log(); return `Retrying. ${statusLine(job)}`; }
  if (verb === 'COLLECTED') { if (!id || !mine) return id ? nf : 'Which job? Reply like `COLLECTED ZP-4825`.'; if (!opCollected(job, { actor })) return `*${id}* isn't waiting for collection.`; log(); return `Thanks. *${id}* is marked as collected.`; }
  log('denied'); return "I didn't catch that. Reply `HELP` to see what I understand.";
}
function waReceive(u, text) {
  waPush(u.id, 'user', text); ui.waTyping = true; refresh('waChat'); setTimeout(scrollWa, 0);
  setTimeout(() => { if (!S) return; ui.waTyping = false; const r = waCommand(u, text); waPush(u.id, 'bot', r); if (typeof onSimChange === 'function') onSimChange(); }, 750);
}
