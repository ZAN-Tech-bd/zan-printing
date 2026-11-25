/* =====================================================================
   12 boot: events, theme, routing, simulation loop
   ===================================================================== */
(function boot() {
  /* theme: honour a stored choice, otherwise follow the device */
  try { const t = localStorage.getItem('zpl-theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; } catch (_) { }
  const meta = $('meta[name="theme-color"]');
  const syncMeta = () => { if (meta) meta.content = effTheme() === 'dark' ? '#0b1224' : '#f4f6fb'; };
  new MutationObserver(syncMeta).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!document.documentElement.dataset.theme) { syncMeta(); refresh('themeBtn'); } });
  syncMeta();

  seed('full');
  document.body.insertAdjacentHTML('afterbegin', iconSprite());

  /* ---------- delegated events ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-act]');
    if (menuRec && !(e.target.closest && e.target.closest('.menu')) && !(el && menuRec.anchor.contains(el))) closeMenu();
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.matches('a[href]') && el.dataset.act !== 'skip') e.preventDefault();
    const f = actions[el.dataset.act];
    if (!f) { console.warn('No action:', el.dataset.act); return; }
    if (el.dataset.act === 'skip') e.preventDefault();
    try { const r = f(el, e); if (r && r.catch) r.catch(err => console.error(err)); } catch (err) { console.error(err); toast({ kind: 'bad', msg: 'Something went wrong. Try again.' }); }
    if (menuRec && el.closest('.menu')) closeMenu(true);
  });
  const onField = e => {
    const el = e.target.closest && e.target.closest('[data-in]'); if (!el) return;
    const f = inputs[el.dataset.in]; if (!f) return;
    if (e.type === 'input' && el.tagName === 'SELECT') return;           // selects use change
    if (e.type === 'change' && el.tagName !== 'SELECT' && !/^(checkbox|radio|file|date|time)$/.test(el.type)) return;  // text uses input
    try { f(el, e); } catch (err) { console.error(err); }
  };
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);

  /* keyboard: Esc, focus trap, activate role=button, arrow keys in menus/tabs/segmented */
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Escape') {
      if (menuRec) { closeMenu(); e.preventDefault(); return; }
      const o = topOverlay(); if (o) { closeOverlay(o.id); e.preventDefault(); } return;
    }
    if (e.key === 'Tab') {
      const o = topOverlay(); if (o) {
        const items = focusables($('.ov-panel', o.el)); if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (!o.el.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
        else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      } return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('[role="button"][data-act]:not(button)')) { e.preventDefault(); t.click(); return; }
    if (menuRec && /^Arrow(Up|Down)$/.test(e.key)) {
      const its = $$('.menu-item:not([disabled])', menuRec.el), i = its.indexOf(document.activeElement);
      its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus(); e.preventDefault(); return;
    }
    if (/^Arrow(Left|Right)$/.test(e.key) && t.matches && t.matches('[role="tab"],.seg [role="radio"]')) {
      const grp = t.closest('[role="tablist"],.seg'); if (!grp) return;
      const its = $$(t.matches('[role="tab"]') ? '[role="tab"]' : '[role="radio"]:not([disabled])', grp), i = its.indexOf(t);
      const n = its[(i + (e.key === 'ArrowRight' ? 1 : -1) + its.length) % its.length]; n.focus(); n.click(); e.preventDefault();
      requestAnimationFrame(() => { const m = $(`#${CSS.escape(n.id || '')}`) || $(focusSig(n) || 'body'); m && m.focus && m.focus({ preventScroll: true }); });
    }
  });

  /* files: picker, drop zones, window-wide drop guard */
  let dragDepth = 0;
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; dragDepth++; document.body.classList.add('dragging-files'); });
  window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging-files'); });
  window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); const z = e.target.closest && e.target.closest('[data-drop]'); $$('[data-drop].over').forEach(x => x !== z && x.classList.remove('over')); if (z) z.classList.add('over'); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging-files'); $$('[data-drop].over').forEach(x => x.classList.remove('over'));
    if (!S.session.role) return toast({ kind: 'info', msg: 'Choose guest or sign in first, then drop your files.' });
    if (!VIEWS[ui.view] || !VIEWS[ui.view].roles.includes(role())) return;
    const dropped = e.dataTransfer.files; if (!dropped || !dropped.length) return;
    if (ui.view !== 'studio') { go('studio'); toast({ kind: 'info', msg: 'Opened Print Studio with your files.' }); }
    ingest(dropped);
  });

  /* ---------- navigation ---------- */
  window.addEventListener('hashchange', () => {
    const n = location.hash.slice(1); if (!S.session.role || !n || n === ui.view) return;
    if (VIEWS[n]) go(n);
  });
  window.addEventListener('keydown', e => { if (e.altKey && /^[1-5]$/.test(e.key) && S.session.role) { const l = Object.keys(VIEWS).filter(k => VIEWS[k].roles.includes(role())); const k = l[+e.key - 1]; if (k) { go(k); e.preventDefault(); } } });

  /* ---------- first render ---------- */
  renderGate();

  /* ---------- simulation loop ---------- */
  setInterval(() => { try { tick(); } catch (err) { console.error(err); } }, 500);
  document.addEventListener('visibilitychange', () => { lastReal = performance.now(); });

  window.__zpl = { get S() { return S; }, demo, ui, go, actions, advance, signIn, startGuest, userById };
})();
