/* =====================================================================
   05 shell: access gate, app shell, router, notifications, settings,
   prototype controls
   ===================================================================== */
const VIEWS = {
  home: { title: 'Home', ic: 'home', skel: 'cards', roles: ['user', 'admin'] },
  studio: { title: 'Print Studio', ic: 'printer', skel: 'cards', roles: ['guest', 'user', 'admin'] },
  files: { title: 'My Files', ic: 'folder', skel: 'cards', roles: ['user', 'admin'] },
  planner: { title: 'Print Planner', ic: 'calendar', skel: 'list', roles: ['user', 'admin'] },
  queue: { title: 'Live Queue', ic: 'queue', skel: 'list', roles: ['guest', 'user', 'admin'] },
  admin: { title: 'Admin', ic: 'shield', skel: 'cards', roles: ['admin'] }
};
const VIEW_RENDER = {};   // filled by each view file
const LIVE = { home: ['homeLive'], studio: ['studioRoute'], queue: ['qPrinters', 'qMine', 'qList'], planner: ['plannerNext'], admin: ['admLive'] };
let renderTok = 0;

/* ---------- theme ---------- */
function effTheme() { return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('zpl-theme', t); } catch (_) { } refresh('themeBtn'); }
actions['theme'] = () => setTheme(effTheme() === 'dark' ? 'light' : 'dark');
REGIONS.themeBtn = () => `<button class="icon-btn" data-act="theme" aria-label="Switch to ${effTheme() === 'dark' ? 'light' : 'dark'} mode">${ic(effTheme() === 'dark' ? 'sun' : 'moon')}</button>`;

/* ---------- routing ---------- */
function go(name, opts = {}) {
  if (!VIEWS[name]) name = isGuest() ? 'studio' : 'home';
  if (!S.session.role) { renderGate(); return; }
  const v = VIEWS[name];
  if (!v.roles.includes(role())) { if (isGuest()) { lockedSheet(name); return; } name = 'home'; }
  const changed = ui.view !== name; ui.view = name;
  try { if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name); } catch (_) { try { location.hash = name; } catch (__) { } }
  renderMain(changed);
}
actions['go'] = el => go(el.dataset.v);
function lockedSheet(name) {
  const t = { files: 'My Files', planner: 'the Print Planner', home: 'your dashboard', admin: 'the admin area' }[name] || 'this page';
  openOverlay({
    id: 'locked', kind: 'dialog', title: `Sign in to use ${t}`, render: () => ({
      body: `<div class="lock-art">${ic('lock')}</div><p class="prose">Guest printing is private by design: nothing is saved and no history is kept. Sign in to keep files, plan prints and get WhatsApp reminders.</p>`,
      foot: `<button class="btn ghost" data-act="ov-close" data-id="locked">Stay as guest</button><button class="btn primary" data-act="guest-to-login">${ic('login')}Sign in</button>`
    })
  });
}
actions['guest-to-login'] = () => { closeOverlay('locked'); endSession(); ui.gate.mode = 'login'; renderGate(); };
function pageHead(title, sub = '', right = '') { return `<div class="page-head"><div><h1 tabindex="-1">${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${right ? `<div class="page-actions">${right}</div>` : ''}</div>`; }

async function renderMain(scrollTop = true) {
  const name = ui.view, v = VIEWS[name], main = $('#view'), tok = ++renderTok; if (!main) return;
  updateNav();
  if (!ui.loaded.has(name)) {
    main.innerHTML = `${pageHead(v.title)}${skel(v.skel)}`; main.setAttribute('aria-busy', 'true');
    try { await api('Load ' + v.title, () => true, rand(380, 640)); } catch (e) {
      if (tok === renderTok) { main.removeAttribute('aria-busy'); main.innerHTML = `${pageHead(v.title)}${errorState(e.message)}`; } return;
    }
    if (tok !== renderTok) return; ui.loaded.add(name);
  }
  main.removeAttribute('aria-busy');
  main.innerHTML = VIEW_RENDER[name]();
  if (typeof afterRender[name] === 'function') afterRender[name]();
  if (scrollTop) { window.scrollTo(0, 0); }
}
const afterRender = {};
actions['reload-view'] = () => renderMain(false);

/* ---------- navigation model ---------- */
function navItems() {
  const r = role();
  if (r === 'guest') return [{ id: 'studio', l: 'Print' }, { id: 'queue', l: 'Queue' }, { id: 'files', l: 'My Files', lock: true }, { id: 'planner', l: 'Planner', lock: true }];
  const a = [{ id: 'home', l: 'Home' }, { id: 'studio', l: 'Print Studio', short: 'Print' }, { id: 'files', l: 'My Files', short: 'Files' }, { id: 'planner', l: 'Planner' }, { id: 'queue', l: 'Live Queue', short: 'Queue' }];
  if (r === 'admin') a.push({ id: 'admin', l: 'Admin', adm: true });
  return a;
}
function navBadge(id) {
  if (!S.session.uid) return '';
  if (id === 'queue') { const n = S.jobs.filter(j => j.owner === S.session.uid && ['Queued', 'Printing', 'Ready for Collection'].includes(j.status)).length; return n ? `<span class="nb">${n}</span>` : ''; }
  if (id === 'planner') { const n = S.jobs.filter(j => j.owner === S.session.uid && j.status === 'Scheduled').length; return n ? `<span class="nb">${n}</span>` : ''; }
  if (id === 'files') { const u = me(), p = pct(usedBytes(u), u.quota); return p >= 80 ? `<span class="nb ${p >= 95 ? 'bad' : 'warn'}" title="${p}% full">${p}%</span>` : ''; }
  if (id === 'admin') { const n = S.jobs.filter(j => j.status === 'Failed' && !j.dismissed && (S.now - j.fail.at) < 3 * DAY).length; return n ? `<span class="nb bad">${n}</span>` : ''; }
  return '';
}
REGIONS.sideNav = () => navItems().map(n => `<a href="#${n.id}" class="nav-i ${ui.view === n.id ? 'on' : ''} ${n.adm ? 'adm' : ''}" data-act="go" data-v="${n.id}" ${ui.view === n.id ? 'aria-current="page"' : ''}>${ic(VIEWS[n.id].ic)}<span>${n.l}</span>${n.lock ? ic('lock', 'lk') : navBadge(n.id)}</a>`).join('');
REGIONS.tabBar = () => {
  const r = role(); let items;
  if (r === 'guest') items = [{ id: 'studio', l: 'Print', fab: true }, { id: 'queue', l: 'Queue' }, { id: 'signin', l: 'Sign in' }];
  else items = [{ id: 'home', l: 'Home' }, { id: 'files', l: 'Files' }, { id: 'studio', l: 'Print', fab: true }, { id: 'planner', l: 'Planner' }, { id: 'queue', l: 'Queue' }];
  return items.map(n => n.id === 'signin' ? `<button class="tab" data-act="guest-to-login">${ic('login')}<span>${n.l}</span></button>` : `<a href="#${n.id}" class="tab ${n.fab ? 'fab' : ''} ${ui.view === n.id ? 'on' : ''}" data-act="go" data-v="${n.id}" ${ui.view === n.id ? 'aria-current="page"' : ''}><span class="tab-ic">${ic(n.id === 'studio' ? 'printer' : VIEWS[n.id].ic)}${navBadge(n.id)}</span><span>${n.l}</span></a>`).join('');
};
function updateNav() { refresh('sideNav', 'tabBar', 'crumb'); }
REGIONS.crumb = () => `<h2 class="crumb">${ic(VIEWS[ui.view].ic)}<span>${VIEWS[ui.view].title}</span></h2>`;
const unread = () => S.notifs.filter(n => n.uid === S.session.uid && !n.read).length;
REGIONS.bell = () => { const n = unread(); return `<button class="icon-btn" data-act="open-notifs" aria-label="Notifications${n ? ', ' + n + ' unread' : ''}">${ic('bell')}${n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : ''}</button>`; };
REGIONS.waBtn = () => { const n = S.waUnread || 0; return `<button class="icon-btn hide-m" data-act="open-wa" aria-label="WhatsApp chat with ZeroClaw${n ? ', ' + n + ' new' : ''}">${ic('chat')}${n ? `<span class="badge">${n}</span>` : ''}</button>`; };
REGIONS.netChip = () => demo.net === 'lan' ? `<span class="net lan" title="You are on the ZAN Print Lab network (${sessionIp()})">${ic('wifi')}<span>Lab network</span></span>` : `<span class="net ext" title="Connected from outside the lab network (${sessionIp()})">${ic('globe')}<span>Remote</span></span>`;
REGIONS.sideFoot = () => {
  const u = me(); if (!u) return `<div class="side-card"><b>Guest session</b><p class="muted sm">Nothing you print is saved. Files are deleted after printing.</p></div>`;
  const used = usedBytes(u), p = pct(used, u.quota);
  return `<button class="side-card as-btn" data-act="go" data-v="files"><div class="row between"><b>Storage</b><span class="sm ${p >= 95 ? 'bad-t' : p >= 80 ? 'warn-t' : 'muted'}">${p}%</span></div>${storageBar(u)}<p class="muted sm">${fmtMB(used)} of ${u.quota / MB} MB used</p></button>`;
};

function renderShell() {
  const u = me(), guest = isGuest();
  $('#app').innerHTML = `<a class="skip" href="#view" data-act="skip">Skip to content</a>
  <div class="shell ${role()}">
    <aside class="side" aria-label="Main">
      <div class="brand">${logoMark(38)}<div><b>ZAN Print Lab</b><small>by ZAN Tech</small></div></div>
      <nav class="nav" data-region="sideNav" aria-label="Primary">${REGIONS.sideNav()}</nav>
      <div class="side-foot" data-region="sideFoot">${REGIONS.sideFoot()}</div>
    </aside>
    <div class="col">
      <header class="top">
        <div class="top-l"><span class="brand-m">${logoMark(30)}</span><div data-region="crumb">${REGIONS.crumb()}</div></div>
        <div class="top-r">
          <span data-region="netChip">${REGIONS.netChip()}</span>
          ${guest ? '' : `<span data-region="waBtn">${REGIONS.waBtn()}</span>`}
          ${guest ? '' : `<span data-region="bell">${REGIONS.bell()}</span>`}
          <span class="hide-m" data-region="themeBtn">${REGIONS.themeBtn()}</span>
          <button class="icon-btn proto" data-act="open-demo" aria-label="Prototype controls" title="Prototype controls">${ic('flask')}</button>
          ${guest ? `<button class="btn primary sm" data-act="guest-to-login">${ic('login')}Sign in</button>` : `<button class="who" data-act="avatar-menu" aria-label="Account menu" aria-haspopup="menu">${avatar(u, 34)}<span class="who-t"><b>${esc(firstName(u))}</b><small>${u.role === 'admin' ? 'Admin' : 'User'}</small></span></button>`}
        </div>
      </header>
      <main id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" data-region="tabBar" aria-label="Primary">${REGIONS.tabBar()}</nav>
  </div>`;
}
actions['skip'] = e => { $('#view').focus(); };
actions['avatar-menu'] = el => {
  const u = me();
  openMenu(el, [
    { label: 'Settings', icon: 'cog', act: 'open-settings' }, { label: 'WhatsApp reminders', icon: 'chat', act: 'open-wa' },
    { label: effTheme() === 'dark' ? 'Light mode' : 'Dark mode', icon: effTheme() === 'dark' ? 'sun' : 'moon', act: 'theme' }, { sep: 1 },
    { label: 'Sign out', icon: 'logout', act: 'logout', hint: u.email }
  ]);
};

/* ---------- session ---------- */
function endSession(msg) {
  if (S.session.role) { const u = me(); audit(S.session.role === 'guest' ? 'guest.end' : 'auth.logout', S.session.role === 'guest' ? 'Guest session' : (u ? u.email : 'unknown user')); }
  S.session = { role: null, uid: null, guestId: null }; ui.studio = null; ui.taskEdit = null; ui.loaded.clear(); OV.slice().forEach(o => closeOverlay(o.id, true)); closeMenu();
  S.waUnread = 0; if (msg) toast({ kind: 'warn', msg });
}
actions['logout'] = () => { endSession(); ui.gate = { mode: 'choose', err: null, busy: false, detecting: true, tries: 0 }; renderGate(); toast({ kind: 'info', msg: 'Signed out.' }); };
function startGuest() {
  S.session = { role: 'guest', uid: null, guestId: 'G' + (1000 + Math.floor(Math.random() * 9000)), ip: '192.168.10.' + (30 + Math.floor(Math.random() * 100)) };
  audit('guest.start', 'Guest session', { detail: 'Printing without an account on the lab network' }); ui.view = 'studio'; ui.studio = null; ui.loaded.clear();
  renderShell(); go('studio');
}
function signIn(u) {
  S.session = { role: u.role, uid: u.id, guestId: null, ip: demo.net === 'lan' ? '192.168.10.' + (20 + hashStr(u.id) % 80) : '103.88.' + (10 + hashStr(u.id) % 80) + '.' + (20 + hashStr(u.id + 'q') % 200) };
  u.net = demo.net; u.lastSeen = S.now; audit('auth.login', u.email, { detail: demo.net === 'lan' ? 'Lab network' : 'Remote (outside lab network)' });
  ui.loaded.clear(); ui.studio = null; ui.view = u.role === 'admin' && ui.view !== 'home' ? 'admin' : 'home';
  renderShell(); go(ui.view === 'admin' ? 'admin' : 'home');
}
function setNet(net) {
  demo.net = net;
  if (isGuest() && net === 'external') { endSession('Guest session ended: you left the lab network. Sign in to keep printing.'); ui.gate = { mode: 'choose', err: null, busy: false, detecting: true, tries: 0 }; renderGate(); }
  else if (!S.session.role) { ui.gate.detecting = true; ui.gate.mode = 'choose'; ui.gate.err = null; renderGate(); }
  else { if (me()) { S.session.ip = net === 'lan' ? '192.168.10.44' : '103.88.21.9'; } refresh('netChip'); toast({ kind: 'info', msg: net === 'lan' ? 'Now on the lab network.' : 'Now connecting from outside the lab network.' }); }
  refresh('demo');
}

/* ---------- access gate ---------- */
function renderGate() {
  const g = ui.gate, lan = demo.net === 'lan'; closeMenu();
  $('#app').innerHTML = `<div class="gate">
    <section class="gate-hero" aria-hidden="false">
      <div class="brand">${logoMark(44)}<div><b>ZAN Print Lab</b><small>ZAN Tech · Uttara, Dhaka</small></div></div>
      <div class="gate-copy"><h1>Print smarter.<br>Pick it up when it's ready.</h1><p>Send files from your phone, plan tomorrow's class sets, and get a WhatsApp nudge before you need them.</p>
        <ul class="gate-pts"><li>${ic('check')}<span>Drop in files, set it once, print in one tap</span></li><li>${ic('check')}<span>Live queue with honest waiting times</span></li><li>${ic('check')}<span>Reminders from ZeroClaw on WhatsApp</span></li></ul></div>
      <div class="stack-art" aria-hidden="true"><i></i><i></i><i></i><span>${ic('printer')}</span></div>
    </section>
    <section class="gate-panel" aria-live="polite">
      <div class="gate-top"><span data-region="themeBtn">${REGIONS.themeBtn()}</span><button class="icon-btn proto" data-act="open-demo" aria-label="Prototype controls" title="Prototype controls">${ic('flask')}</button></div>
      <div class="gate-card">${g.detecting ? gateDetecting() : g.mode === 'login' || !lan ? gateLogin(lan) : gateChoose()}</div>
      <p class="muted sm center gate-foot">Lab hours: Saturday to Thursday, 9:00 AM to 8:00 PM. Closed Fridays.</p>
    </section></div>`;
  if (g.detecting) { const tok = ++renderTok; setTimeout(() => { if (tok === renderTok && !S.session.role) { ui.gate.detecting = false; renderGate(); } }, 900); }
}
function gateDetecting() { return `<div class="net-detect" aria-busy="true"><div class="pulse">${ic('wifi')}</div><h2>Checking your network</h2><p class="muted">Looking for the ZAN Print Lab network…</p><i class="sk w60"></i><i class="sk w40"></i></div>`; }
function gateNetCard(lan) {
  return lan ? `<div class="net-card lan">${ic('wifi')}<div><b>You're on the lab network</b><small>ZAN-Lab-WiFi · 192.168.10.x</small></div><span class="chip good">${ic('check')}Guest printing on</span></div>`
    : `<div class="net-card ext">${ic('globe')}<div><b>You're outside the lab network</b><small>Remote access · sign-in required</small></div><span class="chip warn">${ic('lock')}Guest printing off</span></div>`;
}
function gateChoose() {
  return `${gateNetCard(true)}<h2 class="gate-h">How do you want to print?</h2>
  <button class="choice primary" data-act="guest-start"><span class="ci">${ic('zap')}</span><span><b>Print as guest</b><small>No account. Nothing is saved, and no history is kept.</small></span>${ic('arrow')}</button>
  <button class="choice" data-act="gate-login"><span class="ci">${ic('user')}</span><span><b>Sign in</b><small>My Files, Print Planner, history and WhatsApp reminders.</small></span>${ic('arrow')}</button>`;
}
function gateLogin(lan) {
  const g = ui.gate;
  return `${gateNetCard(lan)}<h2 class="gate-h">Sign in</h2>
  <form id="loginForm" class="form" novalidate data-act-submit="login">
    <div class="field"><label class="lbl" for="lg-email">Email</label><input id="lg-email" name="email" class="input" type="email" autocomplete="username" inputmode="email" placeholder="you@zantechbd.com" value="${esc(g.email || '')}" ${g.busy ? 'disabled' : ''} required/></div>
    <div class="field"><label class="lbl" for="lg-pw">Password</label><input id="lg-pw" name="pw" class="input" type="password" autocomplete="current-password" placeholder="Your password" ${g.busy ? 'disabled' : ''} required/></div>
    ${g.err ? `<div class="notice bad" role="alert">${ic('alert')}<div>${esc(g.err)}</div></div>` : ''}
    <button class="btn primary lg block ${g.busy ? 'is-busy' : ''}" type="submit" ${g.busy ? 'disabled' : ''}>${g.busy ? 'Signing in…' : 'Sign in'}</button>
  </form>
  <div class="demo-acc"><small class="muted">Prototype accounts (password <code>zan2026</code>)</small><div class="row wrap"><button class="chip btnchip" data-act="quick-login" data-id="u1">${ic('user')}Nakib · user</button><button class="chip btnchip" data-act="quick-login" data-id="a1">${ic('shield')}Nusrat · admin</button></div></div>
  ${lan ? `<button class="btn ghost block" data-act="gate-back">${ic('left')}Back</button>` : `<p class="muted sm">Guest printing is only available when you are connected to the lab Wi-Fi.</p>`}`;
}
actions['guest-start'] = () => startGuest();
actions['gate-login'] = () => { ui.gate.mode = 'login'; ui.gate.err = null; renderGate(); setTimeout(() => $('#lg-email') && $('#lg-email').focus(), 30); };
actions['gate-back'] = () => { ui.gate.mode = 'choose'; ui.gate.err = null; renderGate(); };
actions['quick-login'] = async el => { const u = userById(el.dataset.id); ui.gate.email = u.email; const pw = $('#lg-pw'); if (pw) pw.value = 'zan2026'; const em = $('#lg-email'); if (em) em.value = u.email; await doLogin(u.email, 'zan2026'); };
async function doLogin(email, pw) {
  const g = ui.gate; g.email = email; g.err = null; g.busy = true; renderGate(); await sleep(650);
  g.busy = false;
  if (demo.apiMode === 'outage') { g.err = "We couldn't reach the sign-in server. Check your connection and try again."; return renderGate(); }
  if (g.lockUntil && Date.now() < g.lockUntil) { g.err = `Too many attempts. Try again in ${Math.ceil((g.lockUntil - Date.now()) / 1000)} seconds.`; return renderGate(); }
  const u = S.users.find(x => x.email.toLowerCase() === email.toLowerCase());
  if (!email || !pw) { g.err = 'Enter your email and password.'; return renderGate(); }
  if (!u || pw !== 'zan2026') {
    g.tries++; audit('auth.login', email || '(empty)', { actor: 'Unknown (' + sessionIp() + ')', role: 'anon', result: 'denied', detail: `Wrong ${u ? 'password' : 'email or password'} (attempt ${g.tries})` });
    if (g.tries >= 3) { g.lockUntil = Date.now() + 30000; g.tries = 0; g.err = 'Too many attempts. Wait 30 seconds, or ask the lab admin to reset your password.'; } else g.err = `That email and password don't match. ${3 - g.tries} ${3 - g.tries === 1 ? 'try' : 'tries'} left.`;
    return renderGate();
  }
  if (u.status === 'suspended') { audit('auth.login', u.email, { actor: u.name, role: 'user', result: 'denied', detail: 'Account suspended' }); g.err = 'This account is suspended. Contact the lab admin at the front desk.'; return renderGate(); }
  g.tries = 0; signIn(u);
}
document.addEventListener('submit', e => { if (e.target.id === 'loginForm') { e.preventDefault(); doLogin($('#lg-email').value.trim(), $('#lg-pw').value); } });

/* ---------- notifications ---------- */
const NOTIF_IC = { ready: 'box', failed: 'alert', reminder: 'chat', storage: 'database', info: 'info' };
actions['open-notifs'] = () => openOverlay({
  id: 'notifs', kind: 'drawer', title: 'Notifications', render: () => {
    const l = S.notifs.filter(n => n.uid === S.session.uid).sort((a, b) => b.t - a.t);
    return {
      body: l.length ? `<ul class="notif-list">${l.map(n => `<li><button class="notif ${n.read ? '' : 'unread'}" data-act="notif-open" data-id="${n.id}"><span class="n-ic t-${n.type}">${ic(NOTIF_IC[n.type] || 'info')}</span><span class="n-b"><b>${esc(n.title)}</b><small>${esc(n.body)}</small><em>${ago(n.t)}</em></span>${n.read ? '' : '<i class="dot" aria-label="Unread"></i>'}</button></li>`).join('')}</ul>`
        : emptyState({ icon: 'bell', title: "You're all caught up", body: 'Job updates, reminders and storage warnings will show up here.' }),
      foot: l.some(n => !n.read) ? `<button class="btn ghost" data-act="notifs-read">${ic('check')}Mark all as read</button>` : ''
    };
  }
});
actions['notif-open'] = el => { const n = S.notifs.find(x => x.id === el.dataset.id); n.read = true; closeOverlay('notifs'); refresh('bell'); if (n.link) go(n.link); };
actions['notifs-read'] = () => { S.notifs.filter(n => n.uid === S.session.uid).forEach(n => n.read = true); refreshOverlay('notifs'); refresh('bell'); };

/* ---------- settings ---------- */
function sw(on, act, data = '', label = '') { return `<button type="button" role="switch" class="switch ${on ? 'on' : ''}" aria-checked="${on}" aria-label="${esc(label)}" data-act="${act}" ${data}><i></i></button>`; }
actions['open-settings'] = () => openOverlay({
  id: 'settings', kind: 'drawer', title: 'Settings', sub: 'Applies to your account on this lab.', render: () => {
    const u = me(), p = u.prefs, w = u.wa;
    return {
      body: `<section class="set"><h3>Files</h3>
        <div class="set-row"><div><b>Save files after printing</b><small>On by default. Turn off to print without keeping a copy.</small></div>${sw(p.save, 'pref-toggle', 'data-k="save"', 'Save files after printing')}</div>
        <div class="set-row"><div><b>Remove oldest files when full</b><small>Pinned files and files in planned prints are never removed. You always get a warning first.</small></div>${sw(p.autoClean, 'pref-toggle', 'data-k="autoClean"', 'Remove oldest files when full')}</div></section>
      <section class="set"><h3>ZeroClaw on WhatsApp</h3>
        <div class="set-row"><div><b>Connected</b><small>${w.connected ? 'Messages go to ' + esc(u.phone) : 'Reminders and replies are paused.'}</small></div>${sw(w.connected, 'wa-toggle', '', 'WhatsApp connected')}</div>
        <div class="field"><label class="lbl" for="set-phone">WhatsApp number</label><input id="set-phone" class="input" data-in="phone" value="${esc(u.phone)}" inputmode="tel" autocomplete="tel"/></div>
        <div class="field"><label class="lbl" for="set-time">Reminder time</label><input id="set-time" type="time" class="input" data-in="remtime" value="${esc(w.time)}"/><small class="muted">On a task's day, we'll send it at this time, or 30 minutes before the task if that comes first.</small></div>
        <div class="field"><label class="lbl">Message language</label>${seg('pref', 'lang', [{ v: 'en', l: 'English' }, { v: 'bn', l: 'বাংলা' }], w.lang, { label: 'Message language' })}</div>
        <div class="field"><label class="lbl">Default reminders for new tasks</label>${remChips(p.defRem, 'defrem')}</div>
        <button class="btn" data-act="wa-test">${ic('send')}Send a test message</button></section>
      <section class="set"><h3>Appearance</h3><div class="set-row"><div><b>Dark mode</b><small>Follows your device until you change it here.</small></div>${sw(effTheme() === 'dark', 'theme', '', 'Dark mode')}</div></section>`
    };
  }
});
actions['pref-toggle'] = el => { const p = me().prefs; p[el.dataset.k] = !p[el.dataset.k]; refreshOverlay('settings'); refresh('studioSummary'); };
actions['wa-toggle'] = () => { const w = me().wa; w.connected = !w.connected; audit('wa.connection', me().name, { detail: w.connected ? 'Connected' : 'Disconnected' }); refreshOverlay('settings'); refresh('plannerWa', 'plannerList'); };
inputs.phone = (el, e) => { if (e.type === 'change') { me().phone = el.value.trim(); toast({ kind: 'good', msg: 'Number updated. Send a test message to confirm.' }); } };
inputs.remtime = (el, e) => { if (e.type === 'change' && el.value) { me().wa.time = el.value; toast({ kind: 'good', msg: `Reminders now go out at ${fmtTime(atTime(S.now, el.value))}.` }); refresh('plannerWa'); } };
actions['wa-test'] = () => { const u = me(); if (!u.wa.connected) return toast({ kind: 'warn', msg: 'Turn on the WhatsApp connection first.' }); waBot(u.id, `*ZAN Print Lab* · test message\nHi ${firstName(u)}, ZeroClaw is connected to ${u.phone}. Reply \`HELP\` to see commands.`); toast({ kind: 'good', msg: 'Test message sent.', action: { label: 'Open chat', fn: () => actions['open-wa']() } }); };
function remChips(rem, scope) { return `<div class="row wrap rem-chips" role="group" aria-label="Reminder timing">${[[0, 'On the day'], [1, '1 day before'], [2, '2 days before']].map(([o, l]) => `<button type="button" class="chip tog ${rem[o] ? 'on' : ''}" aria-pressed="${!!rem[o]}" data-act="rem-toggle" data-scope="${scope}" data-o="${o}">${rem[o] ? ic('check') : ''}${l}</button>`).join('')}</div>`; }
actions['rem-toggle'] = el => {
  const o = +el.dataset.o, sc = el.dataset.scope;
  if (sc === 'defrem') { const d = me().prefs.defRem; d[o] = !d[o]; if (!d[0] && !d[1] && !d[2]) d[0] = true; refreshOverlay('settings'); }
  else { const t = ui.taskEdit; t.rem[o] = !t.rem[o]; refreshOverlay('task'); }
};
const _segPref = actions['set'];
actions['set'] = el => { if (el.dataset.scope === 'pref') { me().wa.lang = el.dataset.v; refreshOverlay('settings'); } else _segPref(el); };

/* ---------- prototype controls ---------- */
actions['open-demo'] = () => openOverlay({ id: 'demo', kind: 'drawer', title: 'Prototype controls', sub: 'Simulate the network, clock, printers and API. Not part of the product.', render: demoRender });
REGIONS.demo = () => refreshOverlay('demo');
REGIONS.demoClock = () => `${fmtDateLong(S.now)}, <b>${fmtTime(S.now)}</b> <small class="muted">Dhaka</small>`;
function demoRender() {
  const o = (v, cur, l, act, d = '') => `<button class="chip btnchip ${v === cur ? 'on' : ''}" aria-pressed="${v === cur}" data-act="${act}" data-v="${v}" ${d}>${l}</button>`;
  const p1 = S.printers[0];
  return {
    body: `<section class="set"><h3>Network (decides access)</h3><div class="row wrap">${o('lan', demo.net, `${ic('wifi')}On lab Wi-Fi`, 'demo-net')}${o('external', demo.net, `${ic('globe')}Outside (remote)`, 'demo-net')}</div><small class="muted">On the lab network visitors can print as guest. Remote visitors must sign in.</small></section>
    <section class="set"><h3>Sign in as</h3><div class="row wrap"><button class="chip btnchip" data-act="demo-as" data-v="guest">${ic('user')}Guest</button><button class="chip btnchip" data-act="demo-as" data-v="u1">${ic('user')}Nakib (user)</button><button class="chip btnchip" data-act="demo-as" data-v="a1">${ic('shield')}Nusrat (admin)</button></div></section>
    <section class="set"><h3>Clock</h3><p class="clock-now" data-region="demoClock">${REGIONS.demoClock()}</p>
      <div class="row wrap">${[[1, 'Real time'], [6, '6x'], [30, '30x'], [120, '120x']].map(([v, l]) => o(v, demo.speed, l, 'demo-speed')).join('')}<button class="chip btnchip ${demo.paused ? 'on' : ''}" aria-pressed="${demo.paused}" data-act="demo-pause">${ic(demo.paused ? 'play' : 'pause')}${demo.paused ? 'Paused' : 'Pause'}</button></div>
      <div class="row wrap"><button class="chip btnchip" data-act="demo-jump" data-ms="${15 * MIN}">+15 min</button><button class="chip btnchip" data-act="demo-jump" data-ms="${2 * HOUR}">+2 hours</button><button class="chip btnchip" data-act="demo-jump" data-to="eve">Today 6:25 PM</button><button class="chip btnchip" data-act="demo-jump" data-to="tmr">Tomorrow 7:55 AM</button><button class="chip btnchip" data-act="demo-jump" data-to="sun">Sunday 7:55 AM</button></div>
      <small class="muted">Jump ahead to watch reminders go out and scheduled prints start.</small></section>
    <section class="set"><h3>Printers</h3><div class="row wrap"><button class="chip btnchip" data-act="demo-jam">${ic('alert')}Jam Studio Colour</button><button class="chip btnchip" data-act="demo-clear">${ic('wrench')}Clear all jams</button></div></section>
    <section class="set"><h3>API behaviour</h3><div class="row wrap">${o('normal', demo.apiMode, 'Normal', 'demo-api')}${o('flaky', demo.apiMode, 'Flaky (40% fail)', 'demo-api')}${o('outage', demo.apiMode, 'Outage', 'demo-api')}</div><small class="muted">Shows loading, error and retry states across the app.</small></section>
    <section class="set"><h3>Data</h3><div class="row wrap"><button class="chip btnchip" data-act="demo-data" data-v="full">Reset: realistic data</button><button class="chip btnchip" data-act="demo-data" data-v="empty">Reset: empty lab</button></div></section>`
  };
}
actions['demo-net'] = el => setNet(el.dataset.v);
actions['demo-speed'] = el => { demo.speed = +el.dataset.v; refreshOverlay('demo'); };
actions['demo-pause'] = () => { demo.paused = !demo.paused; refreshOverlay('demo'); };
actions['demo-api'] = el => { demo.apiMode = el.dataset.v; if (demo.apiMode === 'outage') ui.loaded.clear(); refreshOverlay('demo'); toast({ kind: 'info', msg: { normal: 'API back to normal.', flaky: 'About 4 in 10 requests will fail.', outage: 'API outage on: pages will fail to load.' }[demo.apiMode] }); };
actions['demo-jam'] = () => { const p = S.printers[0]; if (p.status === 'jam') return; jamPrinter(p, 'Paper jam (simulated)'); refreshOverlay('demo'); onSimChange(); toast({ kind: 'warn', msg: 'Studio Colour jammed. Queued jobs reroute where possible.' }); };
actions['demo-clear'] = () => { S.printers.forEach(p => { if (p.status !== 'online') printerAction(p, 'clear'); }); onSimChange(); toast({ kind: 'good', msg: 'All printers back online.' }); };
actions['demo-jump'] = el => {
  let ms = +el.dataset.ms || 0, to = el.dataset.to;
  if (to === 'eve') ms = atTime(S.now, '18:25') - S.now; if (to === 'tmr') ms = atTime(S.now + DAY, '07:55') - S.now;
  if (to === 'sun') { let d = S.now; while (dow(d) !== 0) d += DAY; ms = atTime(d, '07:55') - S.now; }
  if (ms <= 0) return toast({ kind: 'info', msg: 'That time has already passed today.' });
  advance(ms); onSimChange(); refreshOverlay('demo'); renderMain(false); toast({ kind: 'info', msg: `Skipped to ${fmtDate(S.now)}, ${fmtTime(S.now)}.` });
};
actions['demo-as'] = el => {
  const v = el.dataset.v; closeOverlay('demo', true);
  if (S.session.role) endSession();
  if (v === 'guest') { if (demo.net !== 'lan') { demo.net = 'lan'; } startGuest(); } else signIn(userById(v));
};
actions['demo-data'] = el => { const was = S.session; demo.apiMode = 'normal'; seed(el.dataset.v); S.session = was.role ? was : S.session; ui.loaded.clear(); ui.studio = null; ui.taskEdit = null; if (was.role) { renderShell(); renderMain(); } else renderGate(); refreshOverlay('demo'); toast({ kind: 'good', msg: el.dataset.v === 'empty' ? 'Empty lab: no files, tasks or jobs.' : 'Realistic data restored.' }); };

/* ---------- ticking ---------- */
function onSimChange() { liveRefresh(); refresh('bell', 'waBtn', 'sideNav', 'tabBar', 'sideFoot'); }
function liveRefresh() {
  if (!S.session.role || menuRec) return;
  const names = LIVE[ui.view] || [];
  for (const n of names) {
    const els = $$(`[data-region="${n}"]`); if (!els.length) continue;
    const a = document.activeElement; if (a && els.some(el => el.contains(a)) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) continue;
    refresh(n);
  }
}
let lastReal = performance.now(), tickN = 0;
function tick() {
  const now = performance.now(), dt = Math.min(2000, now - lastReal); lastReal = now;
  if (!S || demo.paused) return;
  const before = S.jobs.map(j => j.status).join('|');
  advance(dt * demo.speed);
  tickN++;
  const changed = before !== S.jobs.map(j => j.status).join('|');
  if (changed) onSimChange(); else if (tickN % 2 === 0) liveRefresh();
  if (tickN % 4 === 0) { refresh('demoClock'); }
}
