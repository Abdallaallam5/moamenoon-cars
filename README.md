# Moamenoon Cars 🚗

A premium full-stack marketplace for **Cars, Motorcycles, and Trucks** — built with Node.js/Express/MongoDB on the backend and vanilla HTML/CSS/JS (with i18next, Swiper, AOS) on the frontend.

![status](https://img.shields.io/badge/status-MVP--complete-C1121F)

## ✨ Features

- Browse, search & filter vehicles by brand, category, price, year, fuel, transmission, mileage, condition, and location
- Vehicle detail pages with image gallery, specs, seller info, WhatsApp/Call buttons, and similar listings
- JWT authentication (register/login), user profiles, favorites, and buyer↔seller messaging
- Seller listing submission with multi-image upload (pending admin approval)
- Full admin dashboard: approve/reject listings, manage brands/categories/users, dashboard stats
- Full English/Arabic localization with RTL support (i18next)
- Fully responsive, dark luxury UI (red/black theme) with glass effects and smooth animations

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS, Fetch API, Swiper.js, AOS, i18next |
| Backend | Node.js, Express.js (MVC architecture) |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |
| Uploads | Multer |
| Validation | express-validator |

## 📁 Project Structure

```
moamenoon-cars/
├── server/                 # Express API (MVC)
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middlewares/
│   ├── config/
│   ├── validators/
│   ├── services/
│   ├── utils/
│   ├── uploads/            # uploaded images (gitignored in production)
│   ├── app.js
│   ├── server.js
│   └── package.json
├── client/                 # Static frontend
│   ├── pages/               # index, cars, motorcycles, trucks, vehicle-details,
│   │                          login, register, profile, favorites, dashboard, contact, about
│   └── assets/
│       ├── css/              # variables, main, components, responsive
│       ├── js/                # api, auth, i18n, main, search, vehicle-details, dashboard
│       ├── locales/           # en/translation.json, ar/translation.json
│       └── images/
└── README.md
```

## 🚀 Getting Started

Zero-config: no MongoDB Atlas account, no `.env` file, and no manual database install needed for local development.

### 1. Prerequisites
- Node.js 18+

### 2. Install, seed, run
```bash
cd server
npm install
npm run seed    # creates the admin account: admin@example.com / Admin@12345
npm run dev      # starts the app (auto-starts a local embedded MongoDB the first time)
```
Run `npm run seed` once *before* `npm run dev` (not at the same time — both need exclusive access to the local database file). The first `npm run seed`/`npm run dev` may take a minute the very first time as it downloads the MongoDB engine once; it's cached after that. Your data lives in `server/data/` and survives restarts — delete that folder to reset everything.

### 3. Open the app
```
http://localhost:5000
```
Log in at `http://localhost:5000/pages/login.html` with `admin@example.com` / `Admin@12345` to reach the admin dashboard at `/pages/dashboard.html`.

### Optional: use your own MongoDB (Atlas or local) instead
Only needed if you want a real shared/production database instead of the built-in local one:
```bash
cp .env.example .env
```
Then edit `server/.env` and set `MONGO_URI` (and a real `JWT_SECRET`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`) to your own values.

The app will be available at **http://localhost:5000** — this redirects to `/pages/index.html`, which is served as a static file alongside the rest of `client/`, and all `/api/*` routes are handled by Express.

## 🔌 API Overview

| Resource | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT /api/auth/profile`, `PUT /api/auth/password` |
| Vehicles | `GET /api/vehicles`, `GET /api/vehicles/:id`, `GET /api/vehicles/:id/similar`, `GET /api/vehicles/my-listings`, `POST /api/vehicles`, `PUT /api/vehicles/:id`, `PUT /api/vehicles/:id/status` (admin), `DELETE /api/vehicles/:id` |
| Brands | `GET/POST /api/brands`, `PUT/DELETE /api/brands/:id` (admin write) |
| Categories | `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id` (admin write) |
| Favorites | `GET /api/favorites`, `POST/DELETE /api/favorites/:vehicleId` |
| Messages | `POST /api/messages`, `GET /api/messages/inbox`, `GET /api/messages/sent`, `PUT /api/messages/:id/read` |
| Reviews | `GET /api/reviews/seller/:sellerId`, `POST /api/reviews`, `PUT/DELETE /api/reviews/:id` |
| Users (admin) | `GET /api/users`, `GET /api/users/dashboard-stats`, `PUT/DELETE /api/users/:id` |

Search/filter query params on `GET /api/vehicles`: `keyword, category, brand, condition, fuel, transmission, priceMin, priceMax, yearMin, yearMax, mileageMax, city, country, sort, page, limit`.

## 🎨 Design System

| Token | Value |
|---|---|
| Primary | `#C1121F` |
| Secondary | `#000000` |
| Background | `#111111` |
| Card | `#1B1B1B` |
| Text | `#FFFFFF` |
| Accent | `#E63946` |
| Display font | Oswald |
| Body font | Inter |

## 🌍 Localization

Translations live in `client/assets/locales/{en,ar}/translation.json`, loaded via `i18next-http-backend`. The language toggle (`#langSwitch` in the navbar) persists the choice to `localStorage` and flips `<html dir>` between `ltr`/`rtl` automatically.

## 🔒 Security Notes

- Passwords hashed with bcrypt (cost factor 12)
- JWT-based auth with role-based access control (`user`, `seller`, `admin`)
- express-validator on all write endpoints
- helmet, CORS, and rate limiting enabled by default
- New listings from non-admins start as `pending` and require admin approval before appearing publicly

## 📄 License

MIT — built for demonstration purposes.
