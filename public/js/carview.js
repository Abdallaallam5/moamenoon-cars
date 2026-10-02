// Car card + car detail dialog, shared by the home page, the cars page and the admin review screen
window.CarView = (() => {
  'use strict';
  const S = window.Site;
  const { esc, t, L, money, num, optLabel } = S;
  const $ = S.$;

  const favs = new Set();
  let favsLoaded = false;
  const title = (c) => `${c.brand} ${c.model} ${c.year}`;
  const catLabel = (c) => t('cat_' + c.category);
  const ICON_NOIMG = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 40h48M14 40l5-14h26l5 14"/><circle cx="20" cy="44" r="4"/><circle cx="44" cy="44" r="4"/></svg>';
  const WA_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5z"/><path d="M8.6 8.4c.3 2.5 3.3 5.5 6 5.9l1.4-1.4-2.1-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-2.1z"/></svg>';
  const HEART ='<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-7-4.6-9.3-9.1C1 8.6 3 5 6.5 5c2 0 3.4 1 4.5 2.6C12.100 6 13.500 5 15.500 5 19 5 21 8.600 21.300 11.900 19 16.400 12 21 12 21z"/></svg>';

  async function loadFavs() {
    favs.clear();
    favsLoaded = false;
    await S.ready;
    if (!S.state.user) return;
    try {
      (await S.api('/favorites/ids')).ids.forEach((i) => favs.add(i));
    } catch (_) { /* not critical */ }
    favsLoaded = true;
  }

  async function toggleFav(id, btns) {
    if (!S.state.user) {
      S.toast(t('login_to_fav'), 'warn');
      return;
    }
    const on = !favs.has(id);
    try {
      await S.api(`/favorites/${id}`, { method: on ? 'POST' : 'DELETE' });
      if (on) favs.add(id); else favs.delete(id);
      (btns || []).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      document.dispatchEvent(new CustomEvent('favchange', { detail: { id, on } }));
    } catch (e) {
      S.toast(S.errText(e), 'err');
    }
  }

  function meta(c) {
    const parts = [String(c.year), optLabel('condition', c.condition)];
    if (c.mileage !== null && c.mileage !== undefined) parts.push(`${num(c.mileage)} ${t('km')}`); // keep number and unit together
    return parts.filter(Boolean).join(' · ');
  }

  /** opts.status: also show a status badge (dashboards) */
  function cardHTML(c, opts = {}) {
    const on = favs.has(c.id);
    const sellerTxt = c.seller.type === 'showroom' ? t('seller_showroom') : c.seller.name || t('seller_dealer');
    return `<article class="car${c.status === 'sold' ? ' is-sold' : ''}" data-id="${c.id}">
      <a class="car-link" href="cars.html?car=${c.id}" aria-label="${esc(title(c))}">
        <div class="car-img">
          ${c.cover ? `<img src="${esc(c.cover)}" alt="${esc(title(c))}" loading="lazy" decoding="async">` : `<div class="noimg">${ICON_NOIMG}</div>`}
          <span class="tag cat">${esc(catLabel(c))}</span>
          ${c.featured ? `<span class="tag star">★ ${esc(t('featured'))}</span>` : ''}
          ${c.status === 'sold' ? `<span class="sold-band">${esc(t('sold'))}</span>` : ''}
          ${opts.status ? `<span class="tag st st-${c.status}">${esc(t('st_' + c.status))}</span>` : ''}
        </div>
        <div class="car-body">
          <h3>${esc(c.brand)} ${esc(c.model)}</h3>
          <p class="meta">${esc(meta(c))}</p>
          <span class="seller">${esc(sellerTxt)}</span>
          <div class="car-foot"><b class="price">${esc(money(c.price))}</b></div>
        </div>
      </a>
      ${c.status === 'sold' ? '' : `<a class="car-wa" href="${esc(waLink(c))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t('ask_wa'))}" title="${esc(t('ask_wa'))}">${WA_ICON}</a>`}
      ${opts.noFav ? '' : `<button class="heart${on ? ' on' : ''}" type="button" data-fav="${c.id}" aria-pressed="${on}" aria-label="${esc(t('nav_fav'))}">${HEART}</button>`}
    </article>`;
  }

  /** Delegated clicks for a grid of cards. intercept: open the dialog instead of navigating. */
  function bindGrid(el, { intercept = false } = {}) {
    el.addEventListener('click', (e) => {
      const heart = e.target.closest('[data-fav]');
      if (heart) {
        e.preventDefault();
        const id = Number(heart.dataset.fav);
        toggleFav(id, [heart]);
        return;
      }
      const link = e.target.closest('.car-link');
      if (link && intercept && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        open(Number(link.closest('.car').dataset.id));
      }
    });
  }

  /* ---------------- detail dialog ---------------- */
  let modal;
  let imgs = [];
  let idx = 0;
  let current = null;
  let lastFocus = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'carModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `<div class="modal-bg" data-close></div>
      <div class="panel wide" role="dialog" aria-modal="true" aria-labelledby="cvTitle">
        <button class="x floating" type="button" data-close data-i18n-aria="close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div class="cv" id="cvBody"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return close();
      const th = e.target.closest('[data-thumb]');
      if (th) return show(Number(th.dataset.thumb));
      if (e.target.closest('[data-prev]')) return show(idx - 1);
      if (e.target.closest('[data-next]')) return show(idx + 1);
      const fav = e.target.closest('[data-fav]');
      if (fav) return toggleFav(current.id, [fav, ...document.querySelectorAll(`.car[data-id="${current.id}"] .heart`)]);
      if (e.target.closest('[data-copy]')) return copyLink();
    });
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowLeft') show(idx + (rtl ? 1 : -1));
      if (e.key === 'ArrowRight') show(idx + (rtl ? -1 : 1));
    });
    return modal;
  }

  function show(i) {
    if (!imgs.length) return;
    idx = (i + imgs.length) % imgs.length;
    const main = $('#cvImg', modal);
    main.src = imgs[idx].url;
    $('#cvCount', modal).textContent = `${idx + 1} / ${imgs.length}`;
    modal.querySelectorAll('[data-thumb]').forEach((el) => el.classList.toggle('on', Number(el.dataset.thumb) === idx));
  }

  function specRow(label, value) {
    return value === null || value === undefined || value === '' ? '' : `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function render(c) {
    const on = favs.has(c.id);
    const sellerTxt = c.seller.type === 'showroom' ? t('seller_showroom') : c.seller.name ? `${t('seller_dealer')} - ${c.seller.name}` : t('seller_dealer');
    const many = imgs.length > 1;
    const specs = [
      specRow(t('spec_cat'), catLabel(c)),
      specRow(t('spec_year'), c.year),
      specRow(t('spec_cond'), optLabel('condition', c.condition)),
      specRow(t('spec_mileage'), c.mileage !== null ? `${num(c.mileage)} ${t('km')}` : null),
      specRow(t('spec_trans'), optLabel('transmission', c.transmission)),
      specRow(t('spec_fuel'), optLabel('fuel', c.fuel)),
      specRow(t('spec_engine'), c.engine_cc ? `${num(c.engine_cc)} CC` : null),
      specRow(t('spec_color'), c.color),
      specRow(t('spec_seller'), sellerTxt),
    ].join('');
    $('#cvBody', modal).innerHTML = `
      <div class="cv-gal">
        <div class="cv-main">
          ${imgs.length ? `<img id="cvImg" alt="${esc(title(c))}">` : `<div class="noimg">${ICON_NOIMG}</div>`}
          ${many ? `<button class="nav-btn prev" type="button" data-prev aria-label="${esc(t('prev'))}">‹</button><button class="nav-btn next" type="button" data-next aria-label="${esc(t('next'))}">›</button>` : ''}
          ${imgs.length ? `<span class="cv-count" id="cvCount"></span>` : ''}
          ${c.status === 'sold' ? `<span class="sold-band">${esc(t('sold'))}</span>` : ''}
        </div>
        ${many ? `<div class="cv-thumbs">${imgs.map((im, i) => `<button type="button" data-thumb="${i}"><img src="${esc(im.thumb || im.url)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div class="cv-info">
        <span class="tag cat inline">${esc(catLabel(c))}</span>
        <h2 id="cvTitle">${esc(c.brand)} ${esc(c.model)} <small>${esc(c.year)}</small></h2>
        <div class="cv-price">${esc(money(c.price))}</div>
        ${c.status === 'rejected' && c.reject_reason ? `<p class="note err"><b>${esc(t('reject_note'))}:</b> ${esc(c.reject_reason)}</p>` : ''}
        <dl class="specs">${specs}</dl>
        ${c.description ? `<h4>${esc(t('desc_label'))}</h4><p class="cv-desc">${esc(c.description)}</p>` : ''}
        <div class="cv-actions">
          <a class="btn" id="cvWa" href="${esc(waLink(c))}" target="_blank" rel="noopener"><svg class="wa-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5z"/><path d="M8.6 8.4c.3 2.5 3.3 5.5 6 5.9l1.4-1.4-2.1-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-2.1z"/></svg><span>${esc(t('ask_wa'))}</span></a>
          <button class="btn ghost icon-btn heart${on ? ' on' : ''}" type="button" data-fav aria-pressed="${on}" aria-label="${esc(t('nav_fav'))}">${HEART}</button>
          <button class="btn ghost" type="button" data-copy>${esc(t('copy_link'))}</button>
        </div>
      </div>`;
    if (imgs.length) show(idx);
  }

  // The message goes to the WhatsApp number the dealer entered for this listing (showroom number if none), written in Arabic
  function waLink(c) {
    const ar = window.I18N.ar;
    const lines = [
      ar.wa_car_hi,
      `*${title(c)}*`,
      `${ar.wa_car_price}: ${c.price === null ? ar.price_call : `${num(c.price)} ${ar.currency}`}`,
      `${ar.wa_car_id}: #${c.id}`,
      `${ar.wa_car_link}: ${location.origin}/cars.html?car=${c.id}`,
    ];
    return S.waUrl(lines.join('\n'), c.whatsapp);
  }

  async function copyLink() {
    const url = `${location.origin}/cars.html?car=${current.id}`;
    try { await navigator.clipboard.writeText(url); } catch (_) {
      const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    S.toast(t('link_copied'));
  }

  async function open(id) {
    ensureModal();
    lastFocus = document.activeElement;
    try {
      const { car } = await S.api(`/cars/${id}`);
      current = car;
      imgs = car.images;
      idx = 0;
      render(car);
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lock');
      const u = new URL(location.href);
      if (u.pathname.endsWith('cars.html') || u.pathname.endsWith('/cars')) { u.searchParams.set('car', id); history.replaceState(null, '', u); }
      $('.x', modal).focus();
    } catch (e) {
      S.toast(S.errText(e), 'err');
    }
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lock');
    const u = new URL(location.href);
    if (u.searchParams.has('car')) { u.searchParams.delete('car'); history.replaceState(null, '', u); }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  S.onLang(() => { if (modal && modal.classList.contains('open') && current) render(current); });

  return { cardHTML, bindGrid, open, close, loadFavs, toggleFav, favs, title, meta, catLabel, isFavsLoaded: () => favsLoaded };
})();
