/* =====================================================================
   02 data: constants, seed data, realistic mock content
   ===================================================================== */
const PAPERS = { A4: '210 × 297 mm', A3: '297 × 420 mm', A5: '148 × 210 mm', Letter: '8.5 × 11 in', Legal: '8.5 × 14 in' };
const PAPER_AR = { A4: 1.414, A3: 1.414, A5: 1.414, Letter: 1.294, Legal: 1.647 };
const DUPLEX = { single: 'Single-sided', long: 'Double-sided', short: 'Double-sided (short edge)' };
const ST = ['Scheduled', 'Queued', 'Printing', 'Ready for Collection', 'Collected', 'Failed', 'Cancelled'];
const ACTIVE_ST = ['Scheduled', 'Queued', 'Printing', 'Ready for Collection'];
const HUES = [222, 262, 172, 24, 338, 148, 198];
const EXT_KIND = { pdf: 'doc', docx: 'doc', doc: 'doc', txt: 'doc', pptx: 'slides', ppt: 'slides', xlsx: 'sheet', xls: 'sheet', csv: 'sheet', png: 'img', jpg: 'img', jpeg: 'img', webp: 'img' };
const OK_EXT = Object.keys(EXT_KIND);
const MAX_FILE = 50 * MB;
const hashStr = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const hueFor = name => HUES[hashStr(name) % HUES.length];
const extOf = n => (n.split('.').pop() || '').toLowerCase();
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const SAMPLES = [
  { name: 'Class 6 - Circuit Basics Handout.pdf', size: 3.4 * MB, pages: 8 },
  { name: 'Term Exam - Robotics (Set A).pdf', size: 5.8 * MB, pages: 6 },
  { name: 'Student Photos - STEM Fair.jpg', size: 9.1 * MB, pages: 1 },
  { name: 'ZAN Annual Report Draft.pdf', size: 28.4 * MB, pages: 64 },
  { name: 'Workshop Certificate A4.pdf', size: 2.2 * MB, pages: 1 }
];

const T0 = Date.UTC(2026, 10, 25, 15, 23) - TZ_OFF; // Wed 25 Nov 2026, 3:23 PM Dhaka

function seed(scenario = 'full') {
  const empty = scenario === 'empty';
  S = { now: T0, scenario, counters: { order: 4836, seq: 0 }, session: { role: null, uid: null, guestId: null }, users: [], files: [], jobs: [], printers: [], notifs: [], audit: [], wa: {}, stats: null, cleaned: [] };
  const mk = (id, name, email, role, org, used, extra = {}) => ({ id, name, email, role, org, usedStatic: used * MB, quota: 100 * MB, status: 'active', phone: '+880 17' + (10000000 + hashStr(name) % 89999999), net: 'lan', joined: T0 - (20 + hashStr(name) % 300) * DAY, lastSeen: T0 - (hashStr(name) % 40) * HOUR, wa: { connected: true, lang: 'en', time: '08:00' }, prefs: { save: true, autoClean: true, defRem: { 0: true, 1: false, 2: false }, last: { paper: 'A4', color: 'bw', orient: 'auto', duplex: 'long' } }, jobsMonth: 10 + hashStr(name) % 70, pagesMonth: 300 + hashStr(name) % 2600, ...extra });
  S.users = [
    mk('u1', 'Nakib Islam', 'nakib@zantechbd.com', 'user', 'ZAN Tech', 0, { phone: '+880 1712-345678', jobsMonth: 34, pagesMonth: 2140 }),
    mk('a1', 'Nusrat Jahan', 'admin@zantechbd.com', 'admin', 'Lab operations', 3, { net: 'lan', jobsMonth: 4, pagesMonth: 60 }),
    mk('u2', 'Tahmid Rahman', 'tahmid@zantechbd.com', 'user', 'Robotics instructor', 61),
    mk('u3', 'Farhana Akter', 'farhana@educate.academy', 'user', 'Educate Academy', 92),
    mk('u4', 'Mehedi Hasan', 'mehedi@zantechbd.com', 'user', 'Uddipon team', 12),
    mk('u5', 'Sadia Islam', 'sadia@zantechbd.com', 'user', 'Curriculum', 47),
    mk('u6', 'Arif Chowdhury', 'arif@educate.academy', 'user', 'Educate Academy', 78),
    mk('u7', 'Rumana Sultana', 'rumana@zantechbd.com', 'user', 'Python to AI instructor', 33),
    mk('u8', 'Kabir Hossain', 'kabir@zantechbd.com', 'user', 'Operations', 96),
    mk('u9', 'Ishrat Jahan', 'ishrat@zantechbd.com', 'user', 'Marketing', 5),
    mk('u10', 'Tanvir Ahmed', 'tanvir@zantechbd.com', 'user', 'Intern (Uddipon)', 0, { status: 'suspended' })
  ];
  S.users.find(u => u.id === 'a1').wa.connected = false;

  /* printers */
  S.printers = [
    { id: 'p1', name: 'Studio Colour', model: 'Canon imageRUNNER C3530i', loc: 'Lab floor, left wall', caps: { color: true, duplex: true, paper: ['A4', 'A3', 'Letter', 'A5'] }, ppm: 30, status: 'online', ink: { K: 58, C: 71, M: 64, Y: 49 }, paper: 78, pages: 48210, warm: 0, idle: true, errors: [{ t: T0 - 3 * DAY, text: 'Paper jam in tray 2 (cleared by Nusrat)' }], serial: 'CNX-3530-0187' },
    { id: 'p2', name: 'Front Desk Mono', model: 'HP LaserJet Pro M404dn', loc: 'Reception desk', caps: { color: false, duplex: true, paper: ['A4', 'Letter', 'Legal', 'A5'] }, ppm: 38, status: 'online', ink: { K: 14 }, paper: 46, pages: 91345, warm: 0, idle: true, errors: [], serial: 'HP-M404-5521' },
    { id: 'p3', name: 'Photo Station', model: 'Epson EcoTank L8050', loc: 'Lab floor, window side', caps: { color: true, duplex: false, paper: ['A4', 'A5'] }, ppm: 12, status: 'online', ink: { K: 80, C: 43, M: 12, Y: 66 }, paper: 9, pages: 6120, warm: 0, idle: true, errors: [{ t: T0 - 4 * HOUR, text: 'Paper jam in photo tray, page 14 (job ZP-4821)' }], serial: 'EPS-8050-0932' }
  ];

  /* files for Nakib */
  const day = n => T0 - n * DAY - (hashStr('f' + n) % 9) * HOUR;
  const F = (n, size, pages, daysAgo, o = {}) => { const ext = extOf(n); return { id: uid('f'), owner: 'u1', name: n, ext, size: size * MB, pages, addedAt: day(daysAgo), lastPrinted: o.lp ? T0 - o.lp * DAY : null, pinned: !!o.pin, kind: EXT_KIND[ext], hue: hueFor(n), est: !!o.est }; };
  if (!empty) S.files = [
    F('Innovator Kit - Assembly Guide.pdf', 18.9, 36, 61, { pin: true, lp: 9 }),
    F('Workshop Photos - Collage.jpg', 16.3, 1, 58, { lp: 40 }),
    F('PCB Layout - Rev C.pdf', 11.2, 3, 52, { lp: 33 }),
    F('STEM Fair - Certificate Template.pdf', 7.6, 1, 44, { lp: 21 }),
    F('Bee-Bot Clone - Wiring Diagram.png', 3.2, 1, 37),
    F('Robotics Safety Poster A3.pdf', 14.5, 1, 30, { lp: 0 }),
    F('Python to AI - Syllabus.docx', 1.8, 9, 24, { lp: 14 }),
    F('Little Coders - Week 6 Worksheet.pdf', 6.4, 12, 19, { lp: 6 }),
    F('Parent Letter - Bangla.docx', 0.7, 2, 15, { lp: 8 }),
    F('Uddipon Workshop - Attendance Sheet.xlsx', 0.4, 2, 9, { lp: 0 }),
    F('CodeZoo Batch 1 - Class Schedule.pdf', 2.1, 4, 6, { lp: 5 }),
    F('Educate Academy - Class Invoice Nov.pdf', 0.9, 2, 2, { lp: 1 })
  ];
  const fid = n => (S.files.find(f => f.name === n) || {}).id || null;
  const mkItem = (name, pages, copies = 1, range = '') => { const ext = extOf(name); return { fileId: fid(name), name, pages, range, copies, ext, kind: EXT_KIND[ext] || 'doc', hue: hueFor(name) }; };
  const mkJob = o => {
    const items = o.items.map(i => mkItem(...i));
    const st = { paper: 'A4', color: 'bw', orient: 'auto', duplex: 'single', ...(o.settings || {}) };
    const t = totals(items, st);
    return { id: uid('j'), order: o.order, owner: o.owner ?? null, guest: o.guest || null, status: o.status, printer: o.printer || null, printerPref: 'auto', items, settings: st, pages: t.pages, impressions: t.impressions, sheets: t.sheets, done: o.done || 0, created: o.created, scheduled: o.scheduled || null, seq: ++S.counters.seq, qkey: o.queuedAt || null, queuedAt: o.queuedAt || null, startedAt: o.startedAt || null, readyAt: o.readyAt || null, collectedAt: o.collectedAt || null, fail: o.fail || null, code: o.code || String(1000 + (hashStr(o.order) % 9000)), shelf: o.shelf || null, rem: o.rem || { 0: true, 1: false, 2: false }, remSent: o.remSent || {}, notifyWa: o.notifyWa ?? false, source: o.source || 'web', save: true, events: o.events || [{ t: o.created, text: 'Submitted' }] };
  };
  const m = n => n * MIN;
  const evs = (c, q, s, r, col) => { const e = [{ t: c, text: 'Submitted' }]; if (q) e.push({ t: q, text: 'Queued' }); if (s) e.push({ t: s, text: 'Started printing' }); if (r) e.push({ t: r, text: 'Ready for collection' }); if (col) e.push({ t: col, text: 'Collected' }); return e; };

  if (!empty) {
    /* live lab activity (other users) */
    S.jobs.push(
      mkJob({ order: 'ZP-4826', owner: 'u3', status: 'Printing', printer: 'p1', items: [['Admission Brochure 2027.pdf', 12, 25]], settings: { color: 'color', duplex: 'long' }, done: 118, created: T0 - m(19), queuedAt: T0 - m(18), startedAt: T0 - m(4), events: evs(T0 - m(19), T0 - m(18), T0 - m(4)) }),
      mkJob({ order: 'ZP-4827', owner: 'u5', status: 'Printing', printer: 'p2', items: [['Class 7 Notes.pdf', 22, 10]], settings: { duplex: 'long' }, done: 61, created: T0 - m(14), queuedAt: T0 - m(13), startedAt: T0 - m(2), events: evs(T0 - m(14), T0 - m(13), T0 - m(2)) }),
      mkJob({ order: 'ZP-4828', owner: 'u6', status: 'Queued', printer: 'p1', items: [['Poster - Science Fair.pdf', 1, 4]], settings: { paper: 'A3', color: 'color' }, created: T0 - m(9), queuedAt: T0 - m(8), events: evs(T0 - m(9), T0 - m(8)) }),
      mkJob({ order: 'ZP-4829', owner: 'u1', status: 'Queued', printer: 'p2', items: [['Uddipon Workshop - Attendance Sheet.xlsx', 2, 3]], settings: { duplex: 'single' }, created: T0 - m(6), queuedAt: T0 - m(6), notifyWa: true, events: evs(T0 - m(6), T0 - m(6)) }),
      mkJob({ order: 'ZP-4830', owner: 'u7', status: 'Queued', printer: 'p2', items: [['Lab Report - Batch 3.docx', 9, 2]], settings: { duplex: 'long' }, created: T0 - m(4), queuedAt: T0 - m(4), events: evs(T0 - m(4), T0 - m(4)) }),
      mkJob({ order: 'ZP-4825', owner: 'u1', status: 'Ready for Collection', printer: 'p1', items: [['Robotics Safety Poster A3.pdf', 1, 2]], settings: { paper: 'A3', color: 'color' }, done: 2, created: T0 - m(31), queuedAt: T0 - m(30), startedAt: T0 - m(20), readyAt: T0 - m(12), shelf: 'B-3', code: '7316', notifyWa: true, events: evs(T0 - m(31), T0 - m(30), T0 - m(20), T0 - m(12)) }),
      mkJob({ order: 'ZP-4824', owner: 'u8', status: 'Ready for Collection', printer: 'p2', items: [['Staff Roster Dec.xlsx', 3, 6]], created: T0 - m(52), queuedAt: T0 - m(51), startedAt: T0 - m(40), readyAt: T0 - m(34), shelf: 'A-1', events: evs(T0 - m(52), T0 - m(51), T0 - m(40), T0 - m(34)) }),
      mkJob({ order: 'ZP-4821', owner: 'u2', status: 'Failed', printer: 'p3', items: [['Certificate Batch - STEM Fair.pdf', 20, 1]], settings: { color: 'color' }, done: 13, created: T0 - m(250), queuedAt: T0 - m(249), startedAt: T0 - m(246), fail: { reason: 'Paper jam in photo tray at page 14 of 20', code: 'E-JAM-402', at: T0 - m(241) }, events: [...evs(T0 - m(250), T0 - m(249), T0 - m(246)), { t: T0 - m(241), text: 'Failed: paper jam in photo tray at page 14 of 20' }] })
    );
    /* Nakib: planner */
    const tmrw = startOfDay(T0) + DAY;
    S.jobs.push(
      mkJob({ order: 'ZP-4832', owner: 'u1', status: 'Scheduled', items: [['Educate Academy - Class Invoice Nov.pdf', 2, 1]], settings: { duplex: 'single' }, created: T0 - 2 * DAY, scheduled: atTime(T0, '18:30'), rem: { 0: true, 1: false, 2: false }, remSent: { 0: T0 - 7 * HOUR - 23 * MIN }, notifyWa: true, events: [{ t: T0 - 2 * DAY, text: 'Scheduled' }] }),
      mkJob({ order: 'ZP-4833', owner: 'u1', status: 'Scheduled', items: [['Little Coders - Week 6 Worksheet.pdf', 12, 30], ['CodeZoo Batch 1 - Class Schedule.pdf', 4, 30, '1-2']], settings: { duplex: 'long' }, created: T0 - 3 * DAY, scheduled: atTime(tmrw, '09:00'), rem: { 0: true, 1: true, 2: false }, remSent: { 1: T0 - 7 * HOUR - 23 * MIN }, notifyWa: true, events: [{ t: T0 - 3 * DAY, text: 'Scheduled' }] }),
      mkJob({ order: 'ZP-4834', owner: 'u1', status: 'Scheduled', items: [['Parent Letter - Bangla.docx', 2, 45]], settings: { duplex: 'single' }, created: T0 - DAY, scheduled: atTime(tmrw, '14:00'), rem: { 0: true, 1: false, 2: false }, notifyWa: true, events: [{ t: T0 - DAY, text: 'Scheduled' }] }),
      mkJob({ order: 'ZP-4835', owner: 'u1', status: 'Scheduled', items: [['Python to AI - Syllabus.docx', 9, 15]], settings: { duplex: 'long' }, created: T0 - 5 * HOUR, scheduled: atTime(T0 + 4 * DAY, '10:00'), rem: { 0: true, 1: false, 2: true }, notifyWa: false, events: [{ t: T0 - 5 * HOUR, text: 'Scheduled' }] })
    );
    /* Nakib: history */
    const hist = [
      ['ZP-4818', 'Collected', 'Little Coders - Week 5 Worksheet.pdf', 12, 30, 1.2, { duplex: 'long' }],
      ['ZP-4811', 'Collected', 'PCB Layout - Rev C.pdf', 3, 2, 2.1, { paper: 'A3', color: 'color' }],
      ['ZP-4807', 'Collected', 'STEM Fair - Certificate Template.pdf', 1, 24, 3.4, { color: 'color' }],
      ['ZP-4802', 'Failed', 'Python to AI - Syllabus.docx', 9, 10, 4.1, { duplex: 'long' }],
      ['ZP-4803', 'Collected', 'Python to AI - Syllabus.docx', 9, 10, 4.0, { duplex: 'long' }],
      ['ZP-4796', 'Cancelled', 'Workshop Photos - Collage.jpg', 1, 1, 6.3, { color: 'color' }],
      ['ZP-4790', 'Collected', 'Innovator Kit - Assembly Guide.pdf', 36, 3, 8.2, { duplex: 'long' }],
      ['ZP-4781', 'Collected', 'Parent Letter - Bangla.docx', 2, 40, 9.5, {}],
      ['ZP-4770', 'Collected', 'Uddipon Workshop - Attendance Sheet.xlsx', 2, 6, 12.1, {}],
      ['ZP-4766', 'Collected', 'Bee-Bot Clone - Wiring Diagram.png', 1, 8, 13.4, { color: 'color' }]
    ];
    hist.forEach(([order, status, name, pg, cp, d, st]) => {
      const c = T0 - d * DAY; const j = mkJob({ order, owner: 'u1', status, printer: st.color === 'color' ? 'p1' : 'p2', items: [[name, pg, cp]], settings: st, done: status === 'Collected' ? pg * cp : status === 'Failed' ? 14 : 0, created: c, queuedAt: c + m(1), startedAt: c + m(3), readyAt: status === 'Collected' ? c + m(14) : null, collectedAt: status === 'Collected' ? c + m(55) : null, shelf: 'A-2', events: status === 'Collected' ? evs(c, c + m(1), c + m(3), c + m(14), c + m(55)) : status === 'Failed' ? [...evs(c, c + m(1), c + m(3)), { t: c + m(6), text: 'Failed: printer went offline' }] : [{ t: c, text: 'Submitted' }, { t: c + m(2), text: 'Cancelled by Nakib Islam' }] });
      if (status === 'Failed') j.fail = { reason: 'Printer went offline during the job', code: 'E-NET-110', at: c + m(6) };
      S.jobs.push(j);
    });
    /* other users finished today: feeds analytics */
    const names = ['Weekly Quiz.pdf', 'Class Notes.pdf', 'Report Cards.xlsx', 'Flyer.pdf', 'Lesson Plan.docx', 'Permission Slip.docx', 'Rubric.pdf'];
    const R = mulberry(7); const ou = ['u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'];
    for (let i = 0; i < 16; i++) {
      const c = startOfDay(T0) + 9 * HOUR + Math.floor(R() * 330) * MIN; const col = R() < 0.3; const pg = 1 + Math.floor(R() * 14), cp = 1 + Math.floor(R() * 12);
      S.jobs.push(mkJob({ order: 'ZP-' + (4795 + i * 1), owner: ou[i % ou.length], status: 'Collected', printer: col ? 'p1' : 'p2', items: [[names[i % names.length], pg, cp]], settings: { color: col ? 'color' : 'bw', duplex: R() < 0.5 ? 'long' : 'single' }, done: pg * cp, created: c, queuedAt: c + m(1), startedAt: c + m(2), readyAt: c + m(10), collectedAt: c + m(40), shelf: 'A-4' }));
    }
    S.jobs.forEach(j => { if (j.status === 'Collected' && !j.items[0].fileId) j.items[0].fileId = null; });
  }

  /* WhatsApp thread + notifications for Nakib */
  S.wa.u1 = [];
  S.wa.a1 = [];
  if (!empty) {
    const u = S.users[0]; const sched = S.jobs.filter(j => j.status === 'Scheduled' && j.owner === 'u1').sort(bySeq);
    const t8 = atTime(T0, '08:00');
    S.wa.u1.push({ id: uid('m'), from: 'bot', t: t8, text: formatDigest(u, 0, sched.filter(j => dayDiff(j.scheduled) === 0)) });
    S.wa.u1.push({ id: uid('m'), from: 'bot', t: t8 + 1000, text: formatDigest(u, 1, sched.filter(j => j.rem[1] && dayDiff(j.scheduled) === 1)) });
    S.notifs = [
      { id: uid('n'), uid: 'u1', t: T0 - 12 * MIN, type: 'ready', title: 'ZP-4825 is ready for collection', body: 'Robotics Safety Poster A3.pdf x2 is waiting on shelf B-3. Pickup code 7316.', read: false, link: 'queue' },
      { id: uid('n'), uid: 'u1', t: t8, type: 'reminder', title: 'WhatsApp plan sent for today', body: 'ZeroClaw sent your print plan: 1 task today, 1 more tomorrow.', read: false, link: 'planner' },
      { id: uid('n'), uid: 'u1', t: T0 - 20 * HOUR, type: 'storage', title: 'My Files is 84% full', body: 'The two oldest unprotected files will be removed first if you run out of space.', read: true, link: 'files' },
      { id: uid('n'), uid: 'u1', t: T0 - 4 * DAY, type: 'failed', title: 'ZP-4802 failed', body: 'The printer went offline during the job. You reprinted it as ZP-4803.', read: true, link: 'queue' }
    ];
  }

  /* audit trail */
  const A = (dt, actor, role, action, target, result = 'success', detail = '', net = 'lan') => S.audit.push({ id: uid('a'), t: T0 - dt, actor, role, action, target, result, detail, net, ip: net === 'lan' ? '192.168.10.' + (20 + hashStr(actor) % 200) : '103.' + (100 + hashStr(actor) % 100) + '.' + (hashStr(actor + 'x') % 250) + '.' + (hashStr(actor + 'y') % 250) });
  [[3 * MIN, 'ZeroClaw', 'system', 'reminder.sent', 'Nakib Islam', 'success', 'Digest for 2 tasks'],
  [4 * MIN, 'Farhana Akter', 'user', 'job.create', 'ZP-4826', 'success', '12 pages x 25, colour, duplex'],
  [6 * MIN, 'Nakib Islam', 'user', 'job.create', 'ZP-4829', 'success', 'Attendance Sheet.xlsx x3'],
  [12 * MIN, 'System', 'system', 'job.ready', 'ZP-4825', 'success', 'Shelf B-3'],
  [31 * MIN, 'Nakib Islam', 'user', 'job.create', 'ZP-4825', 'success', 'A3 colour x2'],
  [38 * MIN, 'Guest 192.168.10.57', 'guest', 'guest.print', 'ZP-4823', 'success', 'Not saved; 1 file'],
  [1 * HOUR, 'Kabir Hossain', 'user', 'file.autoclean', '2 files', 'success', 'Freed 22.4 MB'],
  [2 * HOUR, 'Unknown (103.88.12.40)', 'anon', 'auth.login', 'admin@zantechbd.com', 'denied', 'Wrong password (attempt 3). IP temporarily blocked', 'external'],
  [3 * HOUR, 'Unknown (103.88.12.40)', 'anon', 'auth.login', 'admin@zantechbd.com', 'denied', 'Wrong password (attempt 2)', 'external'],
  [4 * HOUR, 'System', 'system', 'printer.error', 'Photo Station', 'failed', 'Paper jam in photo tray (E-JAM-402)'],
  [4 * HOUR + 5 * MIN, 'Tahmid Rahman', 'user', 'job.create', 'ZP-4821', 'success', 'Certificate batch, 20 pages'],
  [5 * HOUR, 'Nusrat Jahan', 'admin', 'auth.login', 'admin@zantechbd.com', 'success', 'Office network'],
  [7 * HOUR + 23 * MIN, 'ZeroClaw', 'system', 'reminder.sent', 'Nakib Islam', 'success', 'Digest for 1 task today, 1 tomorrow'],
  [20 * HOUR, 'System', 'system', 'storage.warning', 'Nakib Islam', 'success', 'Usage reached 84%'],
  [22 * HOUR, 'Nusrat Jahan', 'admin', 'printer.maintenance', 'Studio Colour', 'success', 'Replaced cyan cartridge'],
  [26 * HOUR, 'Mehedi Hasan', 'user', 'job.cancel', 'ZP-4817', 'success', 'Cancelled before printing'],
  [28 * HOUR, 'Tanvir Ahmed', 'user', 'auth.login', 'tanvir@zantechbd.com', 'denied', 'Account suspended', 'external'],
  [30 * HOUR, 'Nusrat Jahan', 'admin', 'user.suspend', 'Tanvir Ahmed', 'success', 'Internship ended'],
  [2 * DAY, 'Sadia Islam', 'user', 'file.upload', 'Curriculum Pack.pdf', 'success', '14.2 MB, saved'],
  [2 * DAY + HOUR, 'Rumana Sultana', 'user', 'wa.command', 'ZP-4806', 'success', 'POSTPONE 1D'],
  [3 * DAY, 'Nakib Islam', 'user', 'planner.create', 'ZP-4833', 'success', 'Scheduled for tomorrow 9:00 AM'],
  [3 * DAY + 2 * HOUR, 'Nakib Islam', 'user', 'job.fail', 'ZP-4802', 'failed', 'Printer went offline (E-NET-110)']
  ].forEach(a => A(...a));
  S.audit.sort((x, y) => y.t - x.t);

  /* stats for admin analytics (deterministic) */
  const R2 = mulberry(21); const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = T0 - i * DAY; const fri = dow(d) === 5; const jobs = fri ? 3 + Math.floor(R2() * 5) : 36 + Math.floor(R2() * 34);
    const pages = jobs * (14 + Math.floor(R2() * 16)); const col = Math.round(pages * (0.22 + R2() * 0.14));
    days.push({ t: d, jobs, pages, color: col, mono: pages - col, failed: fri ? 0 : Math.floor(R2() * 3), wait: fri ? 1 : 3 + Math.round(R2() * 7) });
  }
  const heat = []; for (let w = 0; w < 7; w++) { const row = []; for (let h = 8; h <= 21; h++) { let v = R2() * 0.3; if (w === 5) v *= 0.1; if (h >= 10 && h <= 12) v += 0.45; if (h >= 15 && h <= 17) v += 0.35; if (w === 6 && h > 14) v *= 0.4; row.push(clamp(v, 0, 1)); } heat.push(row); }
  S.stats = { days, heat };
  if (empty) { S.users.forEach(u => { u.usedStatic = 0; u.jobsMonth = 0; u.pagesMonth = 0; }); S.stats.days.forEach(d => { d.jobs = 0; d.pages = 0; d.color = 0; d.mono = 0; d.failed = 0; d.wait = 0; }); }
  return S;
}

/* order matters little: ready flags for first reminder pass */
function bySeq(a, b) { return (a.scheduled - b.scheduled) || (a.seq - b.seq); }
