const nodemailer = require('nodemailer');
const { SMTP, ADMIN_EMAIL, SITE_URL, BRAND } = require('./config');

const enabled = Boolean(SMTP.user && SMTP.pass);
const transporter = enabled
  ? nodemailer.createTransport(
      SMTP.host
        ? { host: SMTP.host, port: SMTP.port, secure: SMTP.port === 465, auth: { user: SMTP.user, pass: SMTP.pass } }
        : { service: 'gmail', auth: { user: SMTP.user, pass: SMTP.pass } }
    )
  : null;

if (!enabled) {
  console.warn('[mail] SMTP_PASS is not set - emails are printed to the console instead of being sent (see .env.example).');
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout({ lang, title, lines, button }) {
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const body = lines.map((l) => `<p style="margin:0 0 12px;line-height:1.9;color:#e5e5e5">${l}</p>`).join('');
  const btn = button
    ? `<p style="margin:22px 0 4px"><a href="${esc(button.url)}" style="background:#e10a1f;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:700;display:inline-block">${esc(button.label)}</a></p>`
    : '';
  return `<!doctype html><html dir="${dir}"><body style="margin:0;background:#0b0b0c;padding:24px;font-family:Tahoma,Arial,sans-serif">
<div style="max-width:560px;margin:auto;background:#141416;border:1px solid #2a2a2e;border-radius:16px;overflow:hidden">
<div style="background:linear-gradient(135deg,#ff2d40,#8e0010);padding:18px 24px;color:#fff;font-size:20px;font-weight:800">${esc(BRAND)}</div>
<div style="padding:24px"><h2 style="margin:0 0 16px;color:#fff;font-size:19px">${esc(title)}</h2>${body}${btn}</div>
<div style="padding:14px 24px;border-top:1px solid #2a2a2e;color:#8a8a90;font-size:12px">${esc(SITE_URL)}</div>
</div></body></html>`;
}

/** Never throws: a mail failure must not break the request that triggered it. */
async function send({ to, subject, html }) {
  if (!transporter) {
    console.log(`[mail:dry-run] to=${to} | ${subject}`);
    return { sent: false };
  }
  try {
    await transporter.sendMail({ from: `"${BRAND}" <${SMTP.user}>`, to, subject, html });
    return { sent: true };
  } catch (e) {
    console.error('[mail] failed:', e.message);
    return { sent: false };
  }
}

const T = (lang, ar, en) => (lang === 'en' ? en : ar);
const adminUrl = (hash = '') => `${SITE_URL}/admin.html${hash}`;

/* ---------- to the owner (admin) ---------- */
function newDealerRequest(u) {
  const subject = `طلب اشتراك تاجر جديد - ${u.name}`;
  return send({
    to: ADMIN_EMAIL,
    subject,
    html: layout({
      lang: 'ar',
      title: 'طلب اشتراك تاجر جديد',
      lines: [
        `الاسم: <b>${esc(u.name)}</b>`,
        u.business ? `اسم النشاط: <b>${esc(u.business)}</b>` : '',
        `الإيميل: ${esc(u.email)}`,
        `الهاتف: ${esc(u.phone)}`,
        'يرجى مراجعة الطلب من لوحة الإدارة وقبوله أو رفضه.',
      ].filter(Boolean),
      button: { url: adminUrl('#dealers'), label: 'فتح لوحة الإدارة' },
    }),
  });
}

function newCarForReview(car, owner) {
  return send({
    to: ADMIN_EMAIL,
    subject: `سيارة جديدة للمراجعة - ${car.brand} ${car.model} ${car.year}`,
    html: layout({
      lang: 'ar',
      title: 'سيارة جديدة بانتظار المراجعة',
      lines: [
        `السيارة: <b>${esc(car.brand)} ${esc(car.model)} ${esc(car.year)}</b>`,
        `التاجر: ${esc(owner.business || owner.name)} (${esc(owner.email)})`,
        'راجع البيانات والصور، ثم اقبل الإعلان ليظهر على الموقع أو ارفضه مع ذكر السبب.',
      ],
      button: { url: adminUrl('#review'), label: 'مراجعة السيارة' },
    }),
  });
}

/* ---------- to the dealer ---------- */
function dealerReceived(u) {
  const l = u.lang;
  return send({
    to: u.email,
    subject: T(l, 'تم استلام طلب اشتراكك', 'We received your dealer request'),
    html: layout({
      lang: l,
      title: T(l, `أهلًا ${u.name}`, `Hello ${u.name}`),
      lines: [T(l, 'استلمنا طلب اشتراكك كتاجر وهو الآن قيد المراجعة. سنرسل لك إيميلًا فور اتخاذ القرار.', 'We received your dealer request and it is under review. We will email you as soon as a decision is made.')],
    }),
  });
}

function dealerApproved(u) {
  const l = u.lang;
  return send({
    to: u.email,
    subject: T(l, 'تم قبول اشتراكك - جاهز لرفع سياراتك', 'You are approved - ready to upload your cars'),
    html: layout({
      lang: l,
      title: T(l, `مبروك ${u.name}!`, `Congratulations ${u.name}!`),
      lines: [
        T(l, 'تم قبول طلب اشتراكك كتاجر، وحسابك جاهز الآن لرفع صور وبيانات سياراتك.', 'Your dealer request was approved. Your account is now ready to upload your cars, photos and details.'),
        T(l, 'كل سيارة ترفعها تُراجَع من الإدارة أولًا ثم تظهر على الموقع.', 'Every car you upload is reviewed by our team before it appears on the site.'),
      ],
      button: { url: `${SITE_URL}/dealer.html`, label: T(l, 'رفع سياراتي', 'Upload my cars') },
    }),
  });
}

function dealerRejected(u, reason) {
  const l = u.lang;
  return send({
    to: u.email,
    subject: T(l, 'بخصوص طلب اشتراكك', 'About your dealer request'),
    html: layout({
      lang: l,
      title: T(l, 'لم نتمكن من قبول الطلب', 'We could not approve your request'),
      lines: [T(l, 'نأسف، لم يتم قبول طلب اشتراكك كتاجر حاليًا.', 'Sorry, your dealer request was not approved at this time.'), reason ? `${T(l, 'السبب', 'Reason')}: ${esc(reason)}` : ''].filter(Boolean),
    }),
  });
}

function carApproved(car, owner) {
  const l = owner.lang;
  return send({
    to: owner.email,
    subject: T(l, `تم نشر سيارتك - ${car.brand} ${car.model}`, `Your car is live - ${car.brand} ${car.model}`),
    html: layout({
      lang: l,
      title: T(l, 'تمت الموافقة على الإعلان', 'Your listing was approved'),
      lines: [T(l, `سيارتك <b>${esc(car.brand)} ${esc(car.model)} ${esc(car.year)}</b> أصبحت ظاهرة الآن على الموقع.`, `Your <b>${esc(car.brand)} ${esc(car.model)} ${esc(car.year)}</b> is now visible on the site.`)],
      button: { url: `${SITE_URL}/cars.html?car=${car.id}`, label: T(l, 'عرض الإعلان', 'View listing') },
    }),
  });
}

function carRejected(car, owner, reason) {
  const l = owner.lang;
  return send({
    to: owner.email,
    subject: T(l, `سيارتك تحتاج تعديل - ${car.brand} ${car.model}`, `Your car needs changes - ${car.brand} ${car.model}`),
    html: layout({
      lang: l,
      title: T(l, 'لم تتم الموافقة على الإعلان', 'Your listing was not approved'),
      lines: [
        T(l, `سيارتك <b>${esc(car.brand)} ${esc(car.model)} ${esc(car.year)}</b> تحتاج إلى تعديل قبل النشر.`, `Your <b>${esc(car.brand)} ${esc(car.model)} ${esc(car.year)}</b> needs changes before it can be published.`),
        reason ? `${T(l, 'ملاحظات الإدارة', 'Admin notes')}: ${esc(reason)}` : '',
        T(l, 'عدّل البيانات من لوحتك وأعد الإرسال للمراجعة.', 'Edit the details from your dashboard and it will be sent for review again.'),
      ].filter(Boolean),
      button: { url: `${SITE_URL}/dealer.html`, label: T(l, 'فتح لوحتي', 'Open my dashboard') },
    }),
  });
}

module.exports = { newDealerRequest, newCarForReview, dealerReceived, dealerApproved, dealerRejected, carApproved, carRejected, enabled };
