(() => {
  'use strict';
  const S = window.Site;
  const CV = window.CarView;
  const { $, t, esc, money } = S;
  const root = $('#dash');
  let cars = [];

  const box = (title, text, btn) =>
    `<div class="state-box"><h2>${esc(title)}</h2><p>${esc(text)}</p>${btn || ''}</div>`;

  function itemHTML(c) {
    const title = `${c.brand} ${c.model} ${c.year}`;
    return `<article class="item" data-id="${c.id}">
      <div class="item-img">${c.cover ? `<img src="${esc(c.cover)}" alt="" loading="lazy">` : ''}</div>
      <div>
        <h3>${esc(title)}</h3>
        <p class="sub"><span class="status s-${c.status}">${esc(t('st_' + c.status))}</span> &nbsp; ${esc(CV.catLabel(c))} · ${esc(money(c.price))}</p>
        ${c.status === 'rejected' && c.reject_reason ? `<p class="why"><b>${esc(t('reject_note'))}:</b> ${esc(c.reject_reason)}</p>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn ghost sm2" type="button" data-act="view">${esc(t('act_view'))}</button>
        <button class="btn ghost sm2" type="button" data-act="edit">${esc(t('act_edit'))}</button>
        ${c.status === 'published' ? `<button class="btn ghost sm2" type="button" data-act="sold">${esc(t('act_sold'))}</button>` : ''}
        <button class="btn ghost sm2" type="button" data-act="del">${esc(t('act_delete'))}</button>
      </div>
    </article>`;
  }

  function dashboard() {
    const count = (s) => cars.filter((c) => c.status === s).length;
    const stat = (n, label, hot) => `<div class="stat${hot ? ' hot' : ''}"><b>${n}</b><span>${esc(label)}</span></div>`;
    root.innerHTML = `
      <div class="dash-head">
        <div class="page-head" style="margin:0"><h1>${esc(t('dash_title'))}</h1><p>${esc(t('review_note'))}</p></div>
        <button class="btn" type="button" id="addCar">+ ${esc(t('dash_add'))}</button>
      </div>
      <div class="stats">
        ${stat(cars.length, t('dash_mine'))}
        ${stat(count('pending'), t('st_pending'), count('pending') > 0)}
        ${stat(count('published'), t('st_published'))}
        ${stat(count('rejected'), t('st_rejected'), count('rejected') > 0)}
        ${stat(count('sold'), t('st_sold'))}
      </div>
      <div class="list" id="list">${cars.length ? cars.map(itemHTML).join('') : `<div class="empty"><p>${esc(t('dash_empty'))}</p></div>`}</div>`;
  }

  async function reload() {
    try {
      cars = (await S.api('/my/cars')).items;
    } catch (e) {
      S.toast(S.errText(e), 'err');
    }
    dashboard();
  }

  function render() {
    const u = S.state.user;
    if (!u) return void (location.href = 'auth.html?next=dealer.html');
    if (u.role === 'admin') return void (location.href = 'admin.html');
    if (u.role === 'user') {
      root.innerHTML = box(t('user_only_title'), t('user_only_text'), `<a class="btn" href="auth.html?mode=signup&stay=1">${esc(t('nav_signup'))}</a>`);
      return;
    }
    if (u.status === 'pending') {
      root.innerHTML = box(t('pend_title'), t('pend_text'));
      return;
    }
    if (u.status === 'rejected') {
      root.innerHTML = box(t('rej_title'), `${u.reason ? `${u.reason} — ` : ''}${t('rej_text')}`, `<a class="btn" id="rejWa" href="${esc(S.waUrl())}" target="_blank" rel="noopener">${esc(t('foot_wa'))}</a>`);
      return;
    }
    if (cars.length || $('#list')) dashboard(); else reload();
  }

  root.addEventListener('click', async (e) => {
    if (e.target.closest('#addCar')) return CarForm.open({ onSaved: reload });
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.item').dataset.id);
    const act = btn.dataset.act;
    if (act === 'view') return CV.open(id);
    if (act === 'edit') return CarForm.open({ carId: id, onSaved: reload });
    try {
      if (act === 'sold') {
        await S.api(`/my/cars/${id}/sold`, { method: 'POST', body: {} });
        S.toast(t('adm_done'));
      } else if (act === 'del') {
        if (!(await S.ask({ message: t('confirm_delete'), okLabel: t('yes_delete'), danger: true }))) return;
        await S.api(`/my/cars/${id}`, { method: 'DELETE' });
        S.toast(t('adm_done'));
      }
      reload();
    } catch (err) {
      S.toast(S.errText(err), 'err');
    }
  });

  S.onLang(render);
  // Pick up an admin decision without a manual refresh
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && S.state.user) { await S.loadUser(); render(); }
  });

  (async () => {
    await S.ready;
    await CV.loadFavs();
    render();
  })();
})();
