(() => {
  'use strict';

  // Language, nav, account menu and static links are handled by site.js
  const S = window.Site;
  const CATEGORIES = window.CATEGORIES;
  const { $, $$, t, L } = S;

  const state = { get lang() { return S.state.lang; }, cat: null, waUrl: '', lastFocus: null };
  const waBase = S.waUrl();

  /* ---------------- Modal / form ---------------- */
  const modal = $('#modal');
  const form = $('#form');
  const fieldsBox = $('#fields');

  function optionLabel(field, value, lang) {
    const opt = (field.options || []).find((o) => o.v === value);
    return opt ? opt[lang] : value;
  }

  function fieldHTML(f, n) {
    const id = 'f_' + f.name;
    const label = L(f.label);
    const req = f.required ? '<span class="req" aria-hidden="true">*</span>' : '';
    const full = f.full || f.type === 'textarea' || f.type === 'chips' ? ' full' : '';
    const ph = f.ph ? ` placeholder="${L(f.ph)}"` : '';
    const dir = f.ltr ? ' dir="ltr"' : '';
    let control = '';

    if (f.type === 'select' || f.type === 'year') {
      const opts = f.options.map((o) => `<option value="${o.v}">${o[state.lang]}</option>`).join('');
      control = `<select id="${id}" name="${f.name}"><option value="">${t('select_ph')}</option>${opts}</select>`;
    } else if (f.type === 'textarea') {
      control = `<textarea id="${id}" name="${f.name}" rows="3"${ph}></textarea>`;
    } else if (f.type === 'chips') {
      const chips = f.options.map((o) =>
        `<label class="chip"><input type="checkbox" name="${f.name}" value="${o.v}"><span>${o[state.lang]}</span></label>`
      ).join('');
      control = `<div class="chips" role="group" aria-labelledby="${id}_l">${chips}</div>`;
      return `<div class="f${full}" data-field="${f.name}" style="--n:${n}"><span class="lab" id="${id}_l">${label}${req}</span>${control}<span class="err-msg"></span></div>`;
    } else {
      const type = f.type === 'tel' ? 'tel' : 'text';
      const extra = f.type === 'tel' ? ' inputmode="tel" autocomplete="tel"' : f.name === 'name' ? ' autocomplete="name"' : '';
      control = `<input id="${id}" name="${f.name}" type="${type}"${extra}${ph}${dir}>`;
    }
    return `<div class="f${full}" data-field="${f.name}" style="--n:${n}"><label for="${id}">${label}${req}</label>${control}<span class="err-msg"></span></div>`;
  }

  function renderForm(cat) {
    const groups = [
      ['client', t('grp_client')],
      ['car', L(cat.carGroup)],
      ['extra', t('grp_extra')],
    ];
    let n = 0;
    let html = '';
    groups.forEach(([g, title]) => {
      const list = cat.fields.filter((f) => f.group === g);
      if (!list.length) return;
      html += `<h3 class="grp">${title}</h3>`;
      html += list.map((f) => fieldHTML(f, n++)).join('');
    });
    fieldsBox.innerHTML = html;
    updateProgress();
  }

  function getValue(f) {
    const box = $(`[data-field="${f.name}"]`, fieldsBox);
    if (f.type === 'chips') return $$('input:checked', box).map((i) => i.value);
    return $('input,select,textarea', box).value.trim();
  }

  function updateProgress() {
    if (!state.cat) return;
    const req = state.cat.fields.filter((f) => f.required);
    const done = req.filter((f) => {
      const v = getValue(f);
      return Array.isArray(v) ? v.length : v;
    }).length;
    $('#prog').style.width = (req.length ? (done / req.length) * 100 : 0) + '%';
  }

  function validPhone(v) {
    const digits = v.replace(/[\s\-+()]/g, '');
    return /^\d{8,15}$/.test(digits);
  }

  function validate() {
    let firstBad = null;
    let bad = 0;
    state.cat.fields.forEach((f) => {
      const box = $(`[data-field="${f.name}"]`, fieldsBox);
      const v = getValue(f);
      const empty = Array.isArray(v) ? !v.length : !v;
      let msg = '';
      if (f.required && empty) msg = t('err_required');
      else if (f.type === 'tel' && !empty && !validPhone(v)) msg = t('err_phone');
      box.classList.remove('err');
      // restart shake animation
      void box.offsetWidth;
      if (msg) {
        box.classList.add('err');
        $('.err-msg', box).textContent = msg;
        bad++;
        if (!firstBad) firstBad = box;
      }
    });
    return { ok: bad === 0, firstBad };
  }

  // Message is always written in Arabic for the showroom owner
  function collect(cat) {
    const rows = [];
    cat.fields.forEach((f) => {
      const v = getValue(f);
      const empty = Array.isArray(v) ? !v.length : !v;
      if (empty) return;
      let text;
      if (Array.isArray(v)) text = v.map((x) => optionLabel(f, x, 'ar')).join('، ');
      else if (f.type === 'select' || f.type === 'year') text = optionLabel(f, v, 'ar');
      else text = v;
      rows.push({ group: f.group, label: f.label.ar, labelUi: L(f.label), value: text, valueUi: Array.isArray(v) ? v.map((x) => optionLabel(f, x, state.lang)).join(state.lang === 'ar' ? '، ' : ', ') : (f.type === 'select' || f.type === 'year') ? optionLabel(f, v, state.lang) : v });
    });
    return rows;
  }

  function buildMessage(cat, rows) {
    const titles = { client: 'بيانات العميل', car: cat.carGroup.ar, extra: 'تفاصيل إضافية' };
    const lines = ['*طلب جديد من الموقع* 🚗', `القسم: *${cat.title.ar}*`];
    ['client', 'car', 'extra'].forEach((g) => {
      const list = rows.filter((r) => r.group === g);
      if (!list.length) return;
      lines.push('', `*— ${titles[g]} —*`);
      list.forEach((r) => lines.push(`${r.label}: ${r.value}`));
    });
    return lines.join('\n');
  }

  function openModal(key, trigger) {
    state.cat = CATEGORIES[key];
    state.lastFocus = trigger || document.activeElement;
    $('#mTitle').textContent = L(state.cat.title);
    const svg = trigger && $('.ico svg', trigger);
    $('#mIcon').innerHTML = svg ? svg.outerHTML : '';
    $('#success').hidden = true;
    form.hidden = false;
    $('#formErr').hidden = true;
    renderForm(state.cat);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lock');
    $('.panel-body', form).scrollTop = 0;
    setTimeout(() => { const first = $('input,select,textarea', fieldsBox); if (first && window.innerWidth > 640) first.focus(); }, 350);
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lock');
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  function showSuccess(rows) {
    const dl = $('#summary');
    dl.textContent = '';
    dl.appendChild(Object.assign(document.createElement('dt'), { textContent: state.lang === 'ar' ? 'القسم' : 'Category' }));
    dl.appendChild(Object.assign(document.createElement('dd'), { textContent: L(state.cat.title) }));
    rows.forEach((r) => {
      dl.appendChild(Object.assign(document.createElement('dt'), { textContent: r.labelUi }));
      dl.appendChild(Object.assign(document.createElement('dd'), { textContent: r.valueUi }));
    });
    $('#reopenWa').href = state.waUrl;
    form.hidden = true;
    $('#success').hidden = false;
    $('#prog').style.width = '100%';
    $('#success .panel-body').scrollTop = 0;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { ok, firstBad } = validate();
    const err = $('#formErr');
    if (!ok) {
      err.hidden = false;
      err.textContent = t('err_summary');
      void err.offsetWidth;
      if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    err.hidden = true;
    const rows = collect(state.cat);
    state.waUrl = `${waBase}?text=${encodeURIComponent(buildMessage(state.cat, rows))}`;
    window.open(state.waUrl, '_blank', 'noopener');
    showSuccess(rows);
  });

  form.addEventListener('input', (e) => {
    const box = e.target.closest('.f');
    if (box) box.classList.remove('err');
    updateProgress();
  });
  form.addEventListener('change', updateProgress);

  $('#newReq').addEventListener('click', () => {
    const cat = Object.keys(CATEGORIES).find((k) => CATEGORIES[k] === state.cat);
    openModal(cat, state.lastFocus);
  });

  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {
      const items = $$('button, a[href], input, select, textarea', modal).filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- Category cards ---------------- */
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  $$('.cat').forEach((card) => {
    if (card.dataset.cat) card.addEventListener('click', () => openModal(card.dataset.cat, card));
    if (!canHover) return;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', x * 100 + '%');
      card.style.setProperty('--my', y * 100 + '%');
      card.style.setProperty('--ry', (x - 0.5) * 8 + 'deg');
      card.style.setProperty('--rx', (0.5 - y) * 8 + 'deg');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  /* ---------------- Hero parallax ---------------- */
  const hero = $('#hero');
  if (canHover && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      hero.style.setProperty('--px', -x * 22 + 'px');
      hero.style.setProperty('--py', -y * 14 + 'px');
    });
  }

  /* ---------------- Scroll reveal ---------------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.add('in'));
  }

  /* ---------------- Latest cars ---------------- */
  const latest = $('#latest');
  const latestGrid = $('#latestGrid');
  let latestItems = [];
  const CV = window.CarView;

  function renderLatest() {
    latest.hidden = latestItems.length === 0;
    latestGrid.innerHTML = latestItems.map((c) => CV.cardHTML(c)).join('');
  }

  CV.bindGrid(latestGrid);
  S.onLang(renderLatest);
  document.addEventListener('favchange', renderLatest);
  (async () => {
    try {
      const [data] = await Promise.all([S.api('/cars?pageSize=6'), CV.loadFavs()]);
      latestItems = data.items.filter((c) => c.status === 'published');
      renderLatest();
    } catch (_) {
      latest.hidden = true;
    }
  })();
})();
