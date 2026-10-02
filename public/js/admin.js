(() => {
  'use strict';
  const S = window.Site;
  const CV = window.CarView;
  const { $, $$, t, esc, money } = S;
  const root = $('#adm');
  const TABS = ['overview', 'dealers', 'review', 'cars', 'users'];

  const st = {
    tab: TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview',
    stats: null,
    cars: { status: '', q: '', page: 1, items: [], total: 0 },
    users: { role: 'dealer', status: '' },
  };

  const fmtDate = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString(S.state.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB') : '');
  const opts = (list, value) => list.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const empty = () => `<div class="empty"><p>${esc(t('adm_none'))}</p></div>`;

  /* ---------- shell ---------- */
  function shell(body) {
    const s = st.stats || {};
    const tab = (id, label, n) => `<button type="button" data-tab="${id}" class="${st.tab === id ? 'on' : ''}">${esc(label)}${n ? `<span class="badge-n">${n}</span>` : ''}</button>`;
    root.innerHTML = `
      <div class="page-head"><h1>${esc(t('adm_title'))}</h1></div>
      <div class="admin-tabs" role="tablist">
        ${tab('overview', t('adm_overview'))}${tab('dealers', t('adm_dealers'), s.pendingDealers)}${tab('review', t('adm_review'), s.pendingCars)}${tab('cars', t('adm_cars'))}${tab('users', t('adm_users'))}
      </div>
      <div id="tabBody">${body}</div>`;
  }

  async function loadStats() {
    try { st.stats = await S.api('/admin/stats'); } catch (e) { S.toast(S.errText(e), 'err'); }
  }

  /* ---------- renderers ---------- */
  function overview() {
    const s = st.stats || {};
    const stat = (n, label, go, hot) => `<button class="stat${hot ? ' hot' : ''}" type="button" ${go ? `data-go="${go}"` : 'tabindex="-1"'}><b>${n ?? 0}</b><span>${esc(label)}</span></button>`;
    return `<div class="stats">
      ${stat(s.pendingDealers, t('adm_pending_dealers'), 'dealers', s.pendingDealers > 0)}
      ${stat(s.pendingCars, t('adm_pending_cars'), 'review', s.pendingCars > 0)}
      ${stat(s.publishedCars, t('adm_published_cars'), 'cars')}
      ${stat(s.totalCars, t('adm_total_cars'), 'cars')}
      ${stat(s.dealers, t('adm_dealers_n'), 'users')}
      ${stat(s.users, t('adm_users_n'), 'users')}
    </div>`;
  }

  function userItem(u) {
    const actions = [];
    if (u.role === 'dealer' && u.status === 'pending') {
      actions.push(['approve', t('adm_approve'), 'btn ok sm2'], ['reject', t('adm_reject'), 'btn ghost sm2']);
    }
    if (u.role === 'dealer' && u.status === 'rejected') actions.push(['approve', t('adm_approve'), 'btn ok sm2']);
    if (u.status === 'active') actions.push(['suspend', t('adm_suspend'), 'btn ghost sm2']);
    if (u.status === 'suspended') actions.push(['reactivate', t('adm_reactivate'), 'btn ghost sm2']);
    actions.push(['del', t('adm_delete'), 'btn ghost sm2']);
    return `<article class="item user" data-uid="${u.id}">
      <div>
        <h3>${esc(u.name)}${u.business ? ` <span class="muted">· ${esc(u.business)}</span>` : ''}</h3>
        <p class="sub"><span class="status s-${u.status}">${esc(t('st_' + u.status))}</span> &nbsp; ${esc(t('role_' + u.role))} · <span dir="ltr">${esc(u.email)}</span> · <span dir="ltr">${esc(u.phone)}</span></p>
        <p class="sub">${esc(t('adm_joined'))}: ${esc(fmtDate(u.created_at))}${u.role === 'dealer' ? ` · ${u.cars} ${esc(t('adm_cars_n'))}` : ''}${u.reason ? ` · ${esc(u.reason)}` : ''}</p>
      </div>
      <div class="item-actions">${actions.map(([a, l, c]) => `<button class="${c}" type="button" data-uact="${a}">${esc(l)}</button>`).join('')}</div>
    </article>`;
  }

  function carItem(c, review) {
    const o = c.owner || {};
    const actions = [['view', t('act_view'), 'btn ghost sm2']];
    if (review) actions.push(['approve', t('adm_approve'), 'btn ok sm2'], ['reject', t('adm_reject'), 'btn ghost sm2']);
    actions.push(['edit', t('act_edit'), 'btn ghost sm2']);
    if (!review) {
      if (c.status === 'pending' || c.status === 'rejected') actions.push(['approve', t('adm_approve'), 'btn ok sm2']);
      if (c.status === 'published') actions.push(['hide', t('adm_hide'), 'btn ghost sm2'], ['sold', t('adm_sold'), 'btn ghost sm2']);
      if (c.status === 'hidden' || c.status === 'sold') actions.push(['publish', t('adm_publish'), 'btn ghost sm2']);
      actions.push([c.featured ? 'unfeature' : 'feature', c.featured ? t('adm_unfeature') : t('adm_feature'), 'btn ghost sm2']);
    }
    actions.push(['del', t('adm_delete'), 'btn ghost sm2']);
    return `<article class="item" data-id="${c.id}">
      <div class="item-img">${c.cover ? `<img src="${esc(c.cover)}" alt="" loading="lazy">` : ''}</div>
      <div>
        <h3>${esc(c.brand)} ${esc(c.model)} ${esc(c.year)} ${c.featured ? '★' : ''}</h3>
        <p class="sub"><span class="status s-${c.status}">${esc(t('st_' + c.status))}</span> &nbsp; ${esc(CV.catLabel(c))} · ${esc(money(c.price))} · ${c.image_count} 📷</p>
        <p class="sub">${esc(t('adm_owner'))}: ${o.role === 'admin' ? esc(t('seller_showroom')) : `${esc(o.business || o.name)} · <span dir="ltr">${esc(o.email)}</span>`}</p>
        ${c.reject_reason ? `<p class="why">${esc(c.reject_reason)}</p>` : ''}
      </div>
      <div class="item-actions">${actions.map(([a, l, cls]) => `<button class="${cls}" type="button" data-cact="${a}">${esc(l)}</button>`).join('')}</div>
    </article>`;
  }

  /* ---------- tabs ---------- */
  async function showTab() {
    location.hash = st.tab === 'overview' ? '' : st.tab;
    shell('<p class="muted">' + esc(t('loading')) + '</p>');
    const body = $('#tabBody');
    try {
      if (st.tab === 'overview') {
        await loadStats();
        shell(overview());
      } else if (st.tab === 'dealers') {
        const { users } = await S.api('/admin/users?role=dealer&status=pending');
        body.innerHTML = `<div class="list">${users.length ? users.map(userItem).join('') : empty()}</div>`;
      } else if (st.tab === 'review') {
        const { items } = await S.api('/admin/cars?status=pending&pageSize=48');
        body.innerHTML = `<div class="list">${items.length ? items.map((c) => carItem(c, true)).join('') : empty()}</div>`;
      } else if (st.tab === 'cars') {
        await loadCars(true);
      } else if (st.tab === 'users') {
        await loadUsers();
      }
    } catch (e) {
      S.toast(S.errText(e), 'err');
    }
  }

  async function loadCars(reset) {
    const c = st.cars;
    if (reset) { c.page = 1; c.items = []; }
    const p = new URLSearchParams({ page: c.page, pageSize: 24 });
    if (c.status) p.set('status', c.status);
    if (c.q) p.set('q', c.q);
    const data = await S.api(`/admin/cars?${p}`);
    c.items = c.items.concat(data.items);
    c.total = data.total;
    const statuses = [['', t('adm_filter_all')], ...['pending', 'published', 'rejected', 'sold', 'hidden'].map((s) => [s, t('st_' + s)])];
    $('#tabBody').innerHTML = `
      <div class="toolbar">
        <div class="f grow"><input id="cq" type="search" placeholder="${esc(t('adm_search'))}" value="${esc(c.q)}"></div>
        <div class="f"><select id="cstatus" aria-label="${esc(t('adm_status'))}">${opts(statuses, c.status)}</select></div>
        <button class="btn" type="button" id="addShowroom">+ ${esc(t('adm_add_car'))}</button>
      </div>
      <div class="list">${c.items.length ? c.items.map((x) => carItem(x, false)).join('') : empty()}</div>
      ${c.items.length < c.total ? `<div class="more"><button class="btn ghost" type="button" id="moreCars">${esc(t('load_more'))}</button></div>` : ''}`;
  }

  async function loadUsers() {
    const u = st.users;
    const p = new URLSearchParams();
    if (u.role) p.set('role', u.role);
    if (u.status) p.set('status', u.status);
    const { users } = await S.api(`/admin/users?${p}`);
    const roles = [['', t('adm_filter_all')], ['dealer', t('role_dealer')], ['user', t('role_user')]];
    const statuses = [['', t('adm_filter_all')], ...['active', 'pending', 'rejected', 'suspended'].map((s) => [s, t('st_' + s)])];
    $('#tabBody').innerHTML = `
      <div class="toolbar">
        <div class="f"><select id="urole" aria-label="${esc(t('adm_role'))}">${opts(roles, u.role)}</select></div>
        <div class="f"><select id="ustatus" aria-label="${esc(t('adm_status'))}">${opts(statuses, u.status)}</select></div>
      </div>
      <div class="list">${users.length ? users.map(userItem).join('') : empty()}</div>`;
  }

  /* ---------- actions ---------- */
  async function run(fn) {
    try {
      await fn();
      S.toast(t('adm_done'));
      await loadStats();
      await showTab();
    } catch (e) {
      S.toast(S.errText(e), 'err');
    }
  }

  const refresh = async () => { await loadStats(); await showTab(); };

  root.addEventListener('click', async (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { st.tab = tabBtn.dataset.tab; return showTab(); }
    const go = e.target.closest('[data-go]');
    if (go) { st.tab = go.dataset.go; return showTab(); }
    if (e.target.closest('#addShowroom')) return CarForm.open({ admin: true, onSaved: refresh });
    if (e.target.closest('#moreCars')) { st.cars.page += 1; return loadCars(false); }

    const ub = e.target.closest('[data-uact]');
    if (ub) {
      const id = Number(ub.closest('[data-uid]').dataset.uid);
      const a = ub.dataset.uact;
      if (a === 'reject') {
        const reason = await S.ask({ message: t('adm_reason'), prompt: true, placeholder: t('adm_reason_opt'), okLabel: t('adm_reject'), danger: true });
        if (reason === null) return;
        return run(() => S.api(`/admin/users/${id}/reject`, { method: 'POST', body: { reason } }));
      }
      if (a === 'del') {
        if (!(await S.ask({ message: t('adm_delete_user'), okLabel: t('yes_delete'), danger: true }))) return;
        return run(() => S.api(`/admin/users/${id}`, { method: 'DELETE' }));
      }
      return run(() => S.api(`/admin/users/${id}/${a}`, { method: 'POST', body: {} }));
    }

    const cb = e.target.closest('[data-cact]');
    if (cb) {
      const id = Number(cb.closest('[data-id]').dataset.id);
      const a = cb.dataset.cact;
      if (a === 'view') return CV.open(id);
      if (a === 'edit') return CarForm.open({ carId: id, admin: true, onSaved: refresh });
      if (a === 'approve') return run(() => S.api(`/admin/cars/${id}/approve`, { method: 'POST', body: {} }));
      if (a === 'reject') {
        const reason = await S.ask({ message: t('adm_reason'), prompt: true, placeholder: t('adm_reason_opt'), okLabel: t('adm_reject'), danger: true });
        if (reason === null) return;
        return run(() => S.api(`/admin/cars/${id}/reject`, { method: 'POST', body: { reason } }));
      }
      if (a === 'del') {
        if (!(await S.ask({ message: t('confirm_delete'), okLabel: t('yes_delete'), danger: true }))) return;
        return run(() => S.api(`/admin/cars/${id}`, { method: 'DELETE' }));
      }
      if (a === 'feature' || a === 'unfeature') return run(() => S.api(`/admin/cars/${id}/feature`, { method: 'POST', body: { featured: a === 'feature' } }));
      const status = { hide: 'hidden', sold: 'sold', publish: 'published' }[a];
      if (status) return run(() => S.api(`/admin/cars/${id}/status`, { method: 'POST', body: { status } }));
    }
  });

  root.addEventListener('change', async (e) => {
    if (e.target.id === 'cstatus') { st.cars.status = e.target.value; await loadCars(true); }
    if (e.target.id === 'urole') { st.users.role = e.target.value; await loadUsers(); }
    if (e.target.id === 'ustatus') { st.users.status = e.target.value; await loadUsers(); }
  });

  let timer;
  root.addEventListener('input', (e) => {
    if (e.target.id !== 'cq') return;
    clearTimeout(timer);
    timer = setTimeout(async () => { st.cars.q = e.target.value.trim(); await loadCars(true); $('#cq').focus(); }, 300);
  });

  S.onLang(() => showTab());

  (async () => {
    const u = await S.ready;
    if (!u) return void (location.href = 'auth.html?next=admin.html');
    if (u.role !== 'admin') return void (location.href = 'index.html');
    await CV.loadFavs();
    await loadStats();
    await showTab();
  })();
})();
