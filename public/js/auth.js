(() => {
  'use strict';
  const S = window.Site;
  const { $, $$, t } = S;

  const params = new URLSearchParams(location.search);
  // only allow going back to our own pages
  const NEXT_OK = /^(index|cars|dealer|admin)\.html(\?[\w=&%.-]*)?$/;
  const next = NEXT_OK.test(params.get('next') || '') ? params.get('next') : '';
  let mode = params.get('mode') === 'signup' ? 'signup' : 'login';

  const boxes = { login: $('#loginBox'), signup: $('#signupBox'), wait: $('#waitBox') };

  function setMode(m) {
    mode = m;
    boxes.login.hidden = m !== 'login';
    boxes.signup.hidden = m !== 'signup';
    boxes.wait.hidden = m !== 'wait';
    $('.tabs').hidden = m === 'wait';
    $$('.tabs button').forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (m !== 'wait') {
      const u = new URL(location.href);
      if (m === 'signup') u.searchParams.set('mode', 'signup'); else u.searchParams.delete('mode');
      history.replaceState(null, '', u);
    }
  }

  $$('.tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* password show / hide */
  const syncPwLabels = () => $$('[data-pw]').forEach((b) => { b.textContent = t($('#' + b.dataset.pw).type === 'password' ? 'show' : 'hide'); });
  $$('[data-pw]').forEach((b) =>
    b.addEventListener('click', () => {
      const inp = $('#' + b.dataset.pw);
      inp.type = inp.type === 'password' ? 'text' : 'password';
      syncPwLabels();
    })
  );
  S.onLang(syncPwLabels);

  /* dealers get an optional business-name field */
  $$('input[name="type"]').forEach((r) => r.addEventListener('change', () => { $('#bizRow').hidden = $('input[name="type"]:checked').value !== 'dealer'; }));

  function goAfterLogin(user) {
    if (user.role === 'admin') location.href = 'admin.html';
    else if (user.role === 'dealer') location.href = next && next !== 'admin.html' ? next : 'dealer.html';
    else location.href = next && !/^(admin|dealer)/.test(next) ? next : 'cars.html';
  }

  function showError(box, form, e) {
    box.textContent = S.errText(e);
    box.hidden = false;
    $$('.f.err', form).forEach((f) => f.classList.remove('err'));
    if (e.field) {
      const inp = form.elements[e.field === 'email' || e.field === 'password' || e.field === 'name' || e.field === 'phone' ? e.field : ''];
      if (inp && inp.closest) { inp.closest('.f').classList.add('err'); inp.focus(); }
    }
  }

  async function submit(form, errBox, path, body, onOk) {
    const btn = $('button[type="submit"]', form);
    errBox.hidden = true;
    btn.disabled = true;
    try {
      const { user } = await S.api(path, { method: 'POST', body });
      await S.loadUser();
      onOk(user);
    } catch (e) {
      showError(errBox, form, e);
    } finally {
      btn.disabled = false;
    }
  }

  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    submit(f, $('#lErr'), '/auth/login', { email: f.email.value.trim(), password: f.password.value }, goAfterLogin);
  });

  $('#signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const type = $('input[name="type"]:checked', f).value;
    submit(
      f,
      $('#sErr'),
      '/auth/signup',
      { type, name: f.elements.name.value.trim(), email: f.elements.email.value.trim(), phone: f.elements.phone.value.trim(), business: f.elements.business.value.trim(), password: f.elements.password.value, lang: S.state.lang },
      (user) => {
        if (user.role === 'dealer') setMode('wait');
        else goAfterLogin(user);
      }
    );
  });

  (async () => {
    const user = await S.ready;
    if (user && !params.has('stay')) return goAfterLogin(user); // already signed in
    setMode(mode);
    syncPwLabels();
  })();
})();
