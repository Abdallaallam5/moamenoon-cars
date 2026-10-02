// Shared by every page: language, nav account menu, API helper, toasts, dialogs
window.Site = (() => {
  'use strict';
  const CFG = window.SITE_CONFIG;
  const I18N = window.I18N;
  const state = { lang: 'ar', user: null };
  const langListeners = [];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const safe = (fn) => { try { return fn(); } catch (_) { return null; } };
  const t = (k) => (I18N[state.lang] && I18N[state.lang][k]) ?? I18N.ar[k] ?? k;
  const L = (o) => (o ? o[state.lang] ?? o.ar : '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (n) => Number(n).toLocaleString('en-US');
  const money = (n) => (n === null || n === undefined ? t('price_call') : `${num(n)} ${t('currency')}`);
  // number: a specific listing's WhatsApp (international digits); defaults to the showroom's number
  const waUrl = (text, number) => `https://wa.me/${number || CFG.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  /** label of an option value, using the bilingual lists in forms.js */
  const optLabel = (list, value) => {
    const o = (window.OPT[list] || []).find((x) => x.v === value);
    return o ? L(o) : value || '';
  };

  /* ---------------- API ---------------- */
  async function api(path, { method = 'GET', body, form } = {}) {
    const opt = { method, credentials: 'same-origin', headers: {} };
    if (form) opt.body = form;
    else if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('/api' + path, opt);
    } catch (_) {
      const e = new Error('NETWORK');
      e.code = 'NETWORK';
      throw e;
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (!res.ok) {
      const e = new Error((data && data.error) || 'SERVER');
      e.code = e.message;
      e.status = res.status;
      e.field = data && data.field;
      throw e;
    }
    return data;
  }
  const errText = (e) => I18N[state.lang]['err_' + (e && e.code)] || t('err_SERVER');

  /* ---------------- toasts & dialogs ---------------- */
  function toast(msg, type = 'ok') {
    let box = $('#toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 3400);
  }

  /** ask(): styled confirm / prompt. Resolves to true/false, or the typed text for prompts (null if cancelled). */
  function ask({ message, prompt = false, placeholder = '', okLabel, danger = false }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal open dlg';
      wrap.innerHTML = `<div class="modal-bg"></div>
        <div class="panel" role="dialog" aria-modal="true"><div class="panel-body">
          <p class="dlg-msg">${esc(message)}</p>
          ${prompt ? `<textarea class="dlg-input" rows="3" maxlength="500" placeholder="${esc(placeholder)}"></textarea>` : ''}
        </div><div class="panel-foot"><button class="btn ghost" type="button" data-no>${esc(t('cancel'))}</button>
        <button class="btn${danger ? ' danger' : ''}" type="button" data-yes>${esc(okLabel || t('save'))}</button></div></div>`;
      document.body.appendChild(wrap);
      const input = $('.dlg-input', wrap);
      const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(prompt ? null : false); };
      document.addEventListener('keydown', onKey);
      $('[data-no]', wrap).onclick = () => done(prompt ? null : false);
      $('.modal-bg', wrap).onclick = () => done(prompt ? null : false);
      $('[data-yes]', wrap).onclick = () => done(prompt ? input.value.trim() : true);
      (input || $('[data-yes]', wrap)).focus();
    });
  }

  /* ---------------- language ---------------- */
  function applyLang() {
    const html = document.documentElement;
    html.lang = state.lang;
    html.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    const key = document.body.dataset.title;
    document.title = key ? t(key) : t('title');
    const btn = $('#langBtn');
    if (btn) btn.setAttribute('aria-label', t('lang_aria'));
    renderNav();
    langListeners.forEach((fn) => fn(state.lang));
    safe(() => localStorage.setItem('lang', state.lang));
  }

  function toggleLang() {
    document.body.classList.add('swap');
    setTimeout(() => {
      state.lang = state.lang === 'ar' ? 'en' : 'ar';
      applyLang();
      document.body.classList.remove('swap');
    }, 200);
  }

  /* ---------------- nav account menu ---------------- */
  const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>';

  function renderNav() {
    const box = $('#navAuth');
    if (!box) return;
    const u = state.user;
    const link = (href, label) => `<a class="menu-item" href="${href}">${esc(label)}</a>`;
    let items = '';
    if (!u) {
      items = link('auth.html', t('nav_login')) + link('auth.html?mode=signup', t('nav_signup')) + '<hr>' + link('cars.html', t('nav_cars'));
    } else {
      items = `<div class="menu-head"><b>${esc(u.name)}</b><small>${esc(t('role_' + u.role))}</small></div>`;
      if (u.role === 'admin') items += link('admin.html', t('nav_admin'));
      if (u.role === 'dealer') items += link('dealer.html', t('nav_dealer'));
      items += link('cars.html', t('nav_cars')) + link('cars.html?fav=1', t('nav_fav')) + '<hr><button class="menu-item" type="button" data-logout>' + esc(t('nav_logout')) + '</button>';
    }
    box.innerHTML = `<button class="acct" type="button" aria-haspopup="true" aria-expanded="false" aria-label="${esc(t('nav_account'))}">${ICON_USER}<span class="acct-name">${esc(u ? u.name.split(' ')[0] : t('nav_login'))}</span></button><div class="menu" hidden>${items}</div>`;
    const btn = $('.acct', box);
    const menu = $('.menu', box);
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); };
    menu.onclick = (e) => e.stopPropagation();
    const out = $('[data-logout]', box);
    if (out) out.onclick = async () => { try { await api('/auth/logout', { method: 'POST', body: {} }); } catch (_) { /* ignore */ } location.href = 'index.html'; };
    if (!renderNav.bound) {
      document.addEventListener('click', () => { const m = $('#navAuth .menu'); if (m) m.hidden = true; });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const m = $('#navAuth .menu'); if (m) m.hidden = true; } });
      renderNav.bound = true;
    }
  }

  async function loadUser() {
    try {
      state.user = (await api('/auth/me')).user;
    } catch (_) {
      state.user = null;
    }
    renderNav();
    return state.user;
  }

  /* ---------------- init ---------------- */
  const saved = safe(() => localStorage.getItem('lang'));
  if (saved === 'en' || saved === 'ar') state.lang = saved;

  const nav = $('#nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('solid', window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  ['navWa', 'footWa', 'fab'].forEach((id) => { const el = document.getElementById(id); if (el) el.href = waUrl(); });
  const tel = $('#footTel');
  if (tel) { tel.textContent = CFG.displayPhone; tel.href = 'tel:+' + CFG.whatsapp; }
  // footer social links (set once in config.js)
  const social = CFG.social || {};
  [['socFb', social.facebook], ['socIg', social.instagram]].forEach(([id, url]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (url) el.href = url;
    else el.hidden = true;
  });
  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();
  const lb = $('#langBtn');
  if (lb) lb.addEventListener('click', toggleLang);

  applyLang();
  const ready = loadUser();

  return { state, t, L, esc, num, money, waUrl, optLabel, api, errText, toast, ask, ready, loadUser, onLang: (fn) => langListeners.push(fn), $, $$ };
})();
