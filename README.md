# Moamenoon Cars

Car showroom website for **Moamenoon Cars**: imported cars, accessible (adapted) cars, and trucks & heavy equipment.
Visitors browse the catalogue and contact sellers on WhatsApp; approved dealers list their own cars; the showroom owner reviews everything from an admin panel.

> **عربي:** دليل التشغيل على اللاب تحت في قسم [التشغيل السريع](#التشغيل-السريع)، ودليل الرفع على دومين وسيرفر خطوة بخطوة في [`deploy/DEPLOY-AR.md`](deploy/DEPLOY-AR.md).

## Features

- **Arabic / English** with full RTL/LTR switching, black & red theme, mobile first
- **Request forms** (imported / accessible / trucks) that open a ready-made WhatsApp message to the showroom
- **Car catalogue** with category, brand, condition and price filters, search, photo gallery and favourites
- **Per-listing WhatsApp:** every dealer car has its own contact number; showroom cars use the showroom number
- **Accounts:** regular users (instant) and dealers (need admin approval)
- **Review workflow:** every new or edited dealer car is published only after the admin approves it (rejections include a reason)
- **Admin panel:** dealer requests, car reviews, all cars (hide / sold / featured), users (suspend / delete)
- **Email notifications** (Gmail SMTP) for dealer requests, approvals and rejections
- **Photo pipeline:** re-encoded to WebP, 640×480 thumbnails for cards, EXIF/GPS stripped, fake or corrupt files rejected

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 22.13 |
| Server | Express 5 |
| Database | SQLite via the built-in `node:sqlite` (one file, no external DB server) |
| Images | sharp |
| Email | nodemailer |
| Front end | Plain HTML / CSS / JavaScript, no build step |
| Production | nginx + PM2 on an Ubuntu VPS, Let's Encrypt HTTPS, optional Cloudflare |

## Project structure

```
├── server.js              # entry point: security headers, static files, API, graceful shutdown
├── server/
│   ├── config.js          # settings from .env
│   ├── db.js              # schema, indexes, migrations
│   ├── auth.js            # password hashing, signed session cookie, role guards
│   ├── validate.js        # input validation
│   ├── upload.js          # photo processing and upload queue
│   ├── carsService.js     # car queries and writes
│   ├── cache.js           # short in-memory cache for public lists
│   ├── mail.js            # email templates
│   ├── seed.js            # creates the admin account
│   └── routes/            # auth, cars, dealer cars, admin
├── public/                # the website (HTML, CSS, JS, images)
├── scripts/               # admin account, backup, load test
└── deploy/                # VPS setup, nginx, PM2, backups, update + Arabic deployment guide
```

Runtime data (database and uploaded photos) lives in `data/`, which is **not** part of the repository.

## Getting started

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# set ADMIN_PASSWORD in .env (8+ characters)
npm start
```

Open http://localhost:3000 and log in at `/auth.html` with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
Without `SMTP_PASS`, emails are printed to the terminal instead of being sent.

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run admin` | Create an admin or reset its password (asks in the terminal) |
| `npm run backup` | Consistent database backup, safe while the site is running |
| `npm run loadtest -- <url> [connections] [seconds]` | Simple load test |

### Configuration

All settings are environment variables, documented in [`.env.example`](.env.example).
The showroom WhatsApp number and social links are in [`public/js/config.js`](public/js/config.js).

## Deployment

Needs a server that runs Node.js **and keeps files on disk** (a VPS). Static or serverless hosting (Netlify, GitHub Pages, Vercel) cannot keep the database and photos.

`deploy/setup-server.sh` prepares a fresh Ubuntu 24.04 server in one command: Node.js, nginx, PM2 (cluster mode), firewall, swap, HTTPS and daily backups.
Full step-by-step guide (Arabic): [`deploy/DEPLOY-AR.md`](deploy/DEPLOY-AR.md).

---

## التشغيل السريع

المطلوب: **Node.js 22.13 أو أحدث** (`node -v`).

1. افتح المجلد في VS Code، وافتح الـ Terminal.
2. `npm install`
3. `copy .env.example .env` ثم افتح `.env` واكتب باسوورد في `ADMIN_PASSWORD=`.
4. `npm start` وافتح http://localhost:3000
5. ادخل من `/auth.html` بإيميل الأدمن والباسوورد.

- لو PowerShell منع `npm`، اكتب `npm.cmd` بدلها.
- **لتصفير الموقع:** أوقفه وامسح مجلد `data`.
- **رقم واتساب المعرض وروابط الفيس والإنستا:** `public/js/config.js`.

### سير العمل
1. الزائر يسجّل **مستخدم عادي** (فوري) أو **تاجر** (ينتظر موافقة الأدمن).
2. طلب التاجر بيوصل الأدمن بالإيميل، والأدمن يقبل أو يرفض من `/admin.html`، والتاجر بيوصله إيميل بالقرار.
3. التاجر المقبول يرفع سيارات (صور + بيانات + رقم واتساب) من `/dealer.html`، وتبقى **قيد المراجعة**.
4. الأدمن يقبل (تظهر على الموقع) أو يرفض بسبب. أي تعديل من التاجر يرجع للمراجعة.
5. سيارات المعرض نفسه (من الأدمن) بتتنشر فورًا.
