(() => {
  'use strict';
  const S = window.Site;
  const CV = window.CarView;
  const { $, t, esc } = S;

  const params = new URLSearchParams(location.search);
  const st = {
    category: ['import', 'disabled', 'trucks'].includes(params.get('category')) ? params.get('category') : '',
    q: params.get('q') || '',
    brand: params.get('brand') || '',
    condition: ['new', 'used'].includes(params.get('condition')) ? params.get('condition') : '',
    sort: ['price_asc', 'price_desc'].includes(params.get('sort')) ? params.get('sort') : 'new',
    fav: params.get('fav') === '1',
    page: 1,
    items: [],
    total: 0,
    meta: { brands: [], counts: {} },
  };
  const PAGE_SIZE = 12;
  let reqId = 0;

  const grid = $('#grid');
  const empty = $('#empty');
  const more = $('#more');

  /* ---------- controls ---------- */
  function fillSelect(el, options, value) {
    el.innerHTML = options.map(([v, label]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(label)}</option>`).join('');
  }

  function renderControls() {
    const total = Object.values(st.meta.counts).reduce((a, b) => a + b, 0);
    const pills = [['', `${t('f_all')}${total ? ` (${total})` : ''}`], ...['import', 'disabled', 'trucks'].map((c) => [c, `${t('cat_' + c)}${st.meta.counts[c] ? ` (${st.meta.counts[c]})` : ''}`])];
    $('#cats').innerHTML = pills.map(([v, label]) => `<button class="pill${v === st.category ? ' on' : ''}" type="button" data-cat="${v}" aria-pressed="${v === st.category}">${esc(label)}</button>`).join('');
    fillSelect($('#brand'), [['', t('f_all_brands')], ...st.meta.brands.map((b) => [b, b])], st.brand);
    fillSelect($('#cond'), [['', t('cond_all')], ['new', t('cond_new')], ['used', t('cond_used')]], st.condition);
    fillSelect($('#sort'), [['new', t('sort_new')], ['price_asc', t('sort_price_asc')], ['price_desc', t('sort_price_desc')]], st.sort);
    $('#q').value = st.q;
    const favBtn = $('#favOnly');
    favBtn.hidden = !S.state.user;
    favBtn.classList.toggle('on', st.fav);
    favBtn.setAttribute('aria-pressed', String(st.fav));
    $('#filterArea').hidden = st.fav;
    $('#pageTitle').textContent = st.fav ? t('nav_fav') : t('cars_title');
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (st.fav) p.set('fav', '1');
    else {
      if (st.category) p.set('category', st.category);
      if (st.q) p.set('q', st.q);
      if (st.brand) p.set('brand', st.brand);
      if (st.condition) p.set('condition', st.condition);
      if (st.sort !== 'new') p.set('sort', st.sort);
    }
    const car = new URLSearchParams(location.search).get('car');
    if (car) p.set('car', car);
    history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
  }

  /* ---------- data ---------- */
  function query() {
    const p = new URLSearchParams({ page: st.page, pageSize: PAGE_SIZE, sort: st.sort });
    if (st.category) p.set('category', st.category);
    if (st.q) p.set('q', st.q);
    if (st.brand) p.set('brand', st.brand);
    if (st.condition) p.set('condition', st.condition);
    return p.toString();
  }

  async function load(reset) {
    if (reset) {
      st.page = 1;
      st.items = [];
      grid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
      empty.hidden = true;
      more.hidden = true;
    }
    const my = ++reqId;
    try {
      const data = await S.api(st.fav ? '/favorites' : `/cars?${query()}`);
      if (my !== reqId) return; // a newer request replaced this one
      st.items = reset ? data.items : st.items.concat(data.items);
      st.total = data.total;
      renderGrid();
    } catch (e) {
      if (my !== reqId) return;
      grid.innerHTML = '';
      S.toast(S.errText(e), 'err');
    }
  }

  function renderGrid() {
    grid.innerHTML = st.items.map((c) => CV.cardHTML(c)).join('');
    empty.hidden = st.items.length > 0;
    more.hidden = st.fav || st.items.length >= st.total;
    $('#count').textContent = st.items.length ? t('results_n').replace('{n}', st.total) : '';
  }

  /* ---------- events ---------- */
  CV.bindGrid(grid, { intercept: true });

  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    st.category = b.dataset.cat;
    renderControls();
    syncUrl();
    load(true);
  });

  ['brand', 'cond', 'sort'].forEach((id) =>
    $('#' + id).addEventListener('change', (e) => {
      st[id === 'cond' ? 'condition' : id] = e.target.value;
      syncUrl();
      load(true);
    })
  );

  $('#filters').addEventListener('submit', (e) => e.preventDefault()); // Enter in the search box must not reload the page

  let timer;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { st.q = e.target.value.trim(); syncUrl(); load(true); }, 300);
  });

  more.addEventListener('click', () => { st.page += 1; load(false); });

  $('#favOnly').addEventListener('click', () => {
    st.fav = !st.fav;
    renderControls();
    syncUrl();
    load(true);
  });

  document.addEventListener('favchange', (e) => {
    if (!st.fav) return;
    if (!e.detail.on) {
      st.items = st.items.filter((c) => c.id !== e.detail.id);
      st.total = st.items.length;
      renderGrid();
    }
  });

  S.onLang(() => { renderControls(); renderGrid(); });

  /* ---------- start ---------- */
  (async () => {
    await S.ready;
    await CV.loadFavs();
    try { st.meta = await S.api('/cars/meta'); } catch (_) { /* filters just stay empty */ }
    if (st.fav && !S.state.user) st.fav = false;
    renderControls();
    await load(true);
    const car = Number(params.get('car'));
    if (car) CV.open(car);
  })();
})();
