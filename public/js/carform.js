// Add / edit a car (photos + details). Used by the dealer dashboard and the admin panel.
window.CarForm = (() => {
  'use strict';
  const S = window.Site;
  const { $, $$, t, esc } = S;
  const MAX = 8;
  const MAX_SIDE = 1600;

  const years = () => {
    const out = [];
    for (let y = new Date().getFullYear() + 1; y >= 1980; y--) out.push(y);
    return out;
  };

  /** Shrinks a photo in the browser so uploads are fast and the disk does not fill up. */
  async function compress(file) {
    if (!/^image\//.test(file.type)) { const e = new Error('BAD_IMAGE'); e.code = 'BAD_IMAGE'; throw e; }
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale);
      const h = Math.round(bmp.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.84));
      if (blob) return blob;
    } catch (_) { /* fall back to the original file below */ }
    if (file.size <= 5.5 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const e = new Error('FILE_TOO_LARGE');
    e.code = 'FILE_TOO_LARGE';
    throw e;
  }

  const sel = (id, label, options, value, required) =>
    `<div class="f" data-f="${id}"><label for="cf_${id}">${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>
      <select id="cf_${id}" name="${id}"><option value="">${esc(t('cf_select'))}</option>${options
        .map(([v, l]) => `<option value="${esc(v)}"${String(value) === String(v) ? ' selected' : ''}>${esc(l)}</option>`)
        .join('')}</select><span class="err-msg"></span></div>`;

  const inp = (id, label, value, { type = 'text', required = false, full = false, ph = '', ltr = false, max, hint = '' } = {}) =>
    `<div class="f${full ? ' full' : ''}" data-f="${id}"><label for="cf_${id}">${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>
      <input id="cf_${id}" name="${id}" type="${type}" value="${esc(value ?? '')}" placeholder="${esc(ph)}"${ltr ? ' dir="ltr"' : ''}${max ? ` maxlength="${max}"` : ''}${type === 'number' ? ' min="0" inputmode="numeric"' : type === 'tel' ? ' inputmode="tel" autocomplete="tel"' : ''}>${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}<span class="err-msg"></span></div>`;

  // stored as international digits (2010...), shown to the dealer in the familiar local form (010...)
  const localPhone = (n) => (/^20\d{10}$/.test(n || '') ? `0${n.slice(2)}` : n || '');

  /**
   * opts.carId  -> edit that car (loads it first); omit to add a new one
   * opts.admin  -> use the admin endpoints (the owner's own cars are published immediately)
   * opts.onSaved() called after a successful save
   */
  async function open({ carId = null, admin = false, onSaved } = {}) {
    let car = null;
    if (carId) {
      try {
        car = (await S.api(`/cars/${carId}`)).car;
      } catch (e) {
        return S.toast(S.errText(e), 'err');
      }
    }
    const base = admin ? '/admin/cars' : '/my/cars';
    // a dealer's form starts with the number he registered with (he can change it per car)
    const waPrefill = car && car.whatsapp ? localPhone(car.whatsapp) : admin ? '' : (S.state.user && S.state.user.phone) || '';
    const items = (car ? car.images : []).map((im) => ({ kind: 'old', id: im.id, url: im.thumb || im.url }));

    const wrap = document.createElement('div');
    wrap.className = 'modal cform open';
    wrap.innerHTML = `<div class="modal-bg" data-close></div>
      <div class="panel" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
        <div class="panel-head">
          <div class="p-titles"><h2 id="cfTitle">${esc(t(car ? 'cf_edit' : 'cf_new'))}</h2>${admin ? '' : `<p>${esc(t('review_note'))}</p>`}</div>
          <button class="x" type="button" data-close aria-label="${esc(t('close'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <form class="panel-form" novalidate>
          <div class="panel-body"><div class="fields">
            ${sel('category', t('cf_category'), ['import', 'disabled', 'trucks'].map((c) => [c, t('cat_' + c)]), car && car.category, true)}
            ${sel('condition', t('cf_cond'), [['new', t('cond_new')], ['used', t('cond_used')]], car && car.condition, true)}
            ${inp('brand', t('cf_brand'), car && car.brand, { required: true, max: 60 })}
            ${inp('model', t('cf_model'), car && car.model, { required: true, max: 60 })}
            ${sel('year', t('cf_year'), years().map((y) => [y, String(y)]), car && car.year, true)}
            ${inp('price', t('cf_price'), car && car.price, { type: 'number', ltr: true })}
            ${inp('mileage', t('cf_mileage'), car && car.mileage, { type: 'number', ltr: true })}
            ${inp('engine_cc', t('cf_engine'), car && car.engine_cc, { type: 'number', ltr: true })}
            ${sel('transmission', t('cf_trans'), (window.OPT.transmission || []).filter((o) => o.v !== 'any').map((o) => [o.v, S.L(o)]), car && car.transmission)}
            ${sel('fuel', t('cf_fuel'), (window.OPT.fuel || []).filter((o) => o.v !== 'any').map((o) => [o.v, S.L(o)]), car && car.fuel)}
            ${inp('color', t('cf_color'), car && car.color, { max: 40 })}
            ${inp('whatsapp', t('cf_whatsapp'), waPrefill, { type: 'tel', required: !admin, full: true, ltr: true, ph: '01xxxxxxxxx', max: 30, hint: t('cf_whatsapp_hint') })}
            <div class="f full" data-f="description"><label for="cf_description">${esc(t('cf_desc'))}</label><textarea id="cf_description" name="description" rows="4" maxlength="3000">${esc((car && car.description) || '')}</textarea></div>
            <div class="f full" data-f="images"><span class="lab">${esc(t('cf_images'))}<span class="req">*</span></span>
              <div class="photos" id="cfPhotos"></div>
              <span class="field-hint">${esc(t('cf_images_hint'))}</span><span class="err-msg"></span>
              <input id="cfFile" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
            </div>
          </div></div>
          <div class="panel-foot">
            <p class="form-err" id="cfErr" role="alert" hidden></p>
            <button class="btn ghost" type="button" data-close>${esc(t('cancel'))}</button>
            <button class="btn" type="submit" id="cfSubmit">${esc(admin ? t('cf_publish') : t('cf_send_review'))}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('lock');

    const form = $('form', wrap);
    const photosBox = $('#cfPhotos', wrap);
    const fileInput = $('#cfFile', wrap);
    const errBox = $('#cfErr', wrap);

    const close = () => {
      items.forEach((i) => i.kind === 'new' && URL.revokeObjectURL(i.url));
      wrap.remove();
      document.body.classList.remove('lock');
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal.dlg')) close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

    function renderPhotos() {
      photosBox.innerHTML =
        items
          .map((it, i) => `<div class="photo"><img src="${esc(it.url)}" alt=""><button class="rm" type="button" data-rm="${i}" aria-label="${esc(t('cf_remove'))}">×</button>${i === 0 ? `<span class="cover">${esc(t('cf_cover'))}</span>` : ''}</div>`)
          .join('') +
        (items.length < MAX ? `<button class="photo-add" type="button" data-add><b>+</b>${esc(t('cf_add_photos'))}</button>` : '');
    }
    photosBox.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) return fileInput.click();
      const rm = e.target.closest('[data-rm]');
      if (rm) {
        const [gone] = items.splice(Number(rm.dataset.rm), 1);
        if (gone.kind === 'new') URL.revokeObjectURL(gone.url);
        renderPhotos();
      }
    });
    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files).slice(0, MAX - items.length);
      fileInput.value = '';
      for (const f of files) {
        try {
          const blob = await compress(f);
          items.push({ kind: 'new', blob, url: URL.createObjectURL(blob) });
        } catch (e) {
          S.toast(S.errText(e), 'err');
        }
      }
      $('[data-f="images"]', wrap).classList.remove('err');
      errBox.hidden = true;
      renderPhotos();
    });
    renderPhotos();

    function fail(field, msg) {
      const row = $(`[data-f="${field}"]`, wrap);
      if (row) {
        row.classList.add('err');
        $('.err-msg', row).textContent = msg;
        const c = $('input,select,textarea,.photo-add', row);
        if (c && c.focus) c.focus();
      }
      errBox.textContent = msg;
      errBox.hidden = false;
    }

    form.addEventListener('input', (e) => {
      const r = e.target.closest('.f');
      if (r) r.classList.remove('err');
      errBox.hidden = true;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      $$('.f.err', form).forEach((r) => r.classList.remove('err'));
      for (const id of ['category', 'condition', 'year', 'brand', 'model']) {
        if (!form.elements[id].value.trim()) return fail(id, t('err_' + { category: 'INVALID_CATEGORY', condition: 'INVALID_CONDITION', year: 'INVALID_YEAR', brand: 'INVALID_BRAND', model: 'INVALID_MODEL' }[id]));
      }
      if (!admin && !form.elements.whatsapp.value.trim()) return fail('whatsapp', t('err_INVALID_WHATSAPP'));
      if (!items.length) return fail('images', t('err_NO_IMAGES'));

      const fd = new FormData();
      ['category', 'condition', 'brand', 'model', 'year', 'price', 'mileage', 'engine_cc', 'transmission', 'fuel', 'color', 'whatsapp', 'description'].forEach((k) => fd.append(k, form.elements[k].value.trim()));
      fd.append('keep', JSON.stringify(items.filter((i) => i.kind === 'old').map((i) => i.id)));
      items.filter((i) => i.kind === 'new').forEach((i, n) => fd.append('images', i.blob, `photo-${n}.jpg`));

      const btn = $('#cfSubmit', wrap);
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = t('cf_working');
      try {
        await S.api(car ? `${base}/${car.id}` : base, { method: car ? 'PUT' : 'POST', form: fd });
        S.toast(t(admin ? 'cf_saved' : 'cf_saved_review'));
        close();
        if (onSaved) onSaved();
      } catch (err) {
        fail(err.field || '', S.errText(err));
        btn.disabled = false;
        btn.textContent = label;
      }
    });

    setTimeout(() => { const f = form.elements.brand; if (f && window.innerWidth > 640) f.focus(); }, 300);
  }

  return { open };
})();
