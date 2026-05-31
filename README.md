# Nippon Toyota — Smart Incentive Calculator

A role-based web platform that computes **tiered, slab-wise monthly incentives** for vehicle Sales Officers. Admins own the pricing model (car inventory + incentive slabs); Sales Officers log the current month's sales and watch their projected payout update **in real time** — with rich analytics dashboards, audit-friendly timestamps, CSV export, and a light/dark theme.

> Internship Practical Evaluation · Task 2 — Django REST Framework + React + PostgreSQL.

---

## 🌐 Live demo

| Surface | URL |
|---|---|
| **Web app** (SPA) | https://toyotaincentive.23cs160saja.workers.dev |
| **API health** | https://nippon-incentive-api-0rzk.onrender.com/api/health/ |

Sign in with the [demo credentials](#-demo-credentials). The free API is kept warm by an uptime monitor, so there's no cold-start wait.

---

## ✨ Highlights

- **Whole-slab incentive engine** isolated in a single pure, unit-tested function (`calculate_incentive`) — swappable to a progressive model in one line.
- **Server-enforced RBAC** with JWT — Admin vs. Approved Sales Officer, gated on *every* endpoint (not just hidden in the UI).
- **Account approval state machine** — public signup → `PENDING` → admin approves → login enabled. Rejected/pending logins are blocked with a clear `403`.
- **Live slab validation** — overlaps/gaps are impossible by construction in the editor and verified by the server (dry-run + atomic bulk replace).
- **Real-time payout tracker** — debounced calls to the server's single source of truth as the officer types; animated payout, highlighted tier, per-model breakdown.
- **Analytics dashboards** — admin participation / at-risk / payout-concentration / officer comparison; officer rank, streak, pace, next-tier nudge, trend, and tier history.
- **Current-month integrity** — officers can only log the current month (enforced server-side *and* in the UI), so trends and comparisons stay trustworthy. Every sales line carries `created_at` / `updated_at` timestamps for audit logging.
- **One-click CSV export** for every role — per-month summary or per-model detail.
- **Light/dark theme** — loads **light by default**, remembers the user's choice, no flash on load.
- **Premium responsive UI** — Toyota-red accent, Archivo display type with tabular figures, loading/empty/error states everywhere, mobile bottom-nav.
- **One-command seed** that populates ~9 months of varied history for instant, graph-rich demos.

---

## 🧱 Tech Stack

| Layer | Choice |
|---|---|
| API | Django 5.2 · Django REST Framework · SimpleJWT |
| DB | PostgreSQL via `DATABASE_URL` (Supabase in production) — falls back to **SQLite** locally with zero setup |
| Cache | Django cache framework · Redis via `CACHE_URL` in production · local-memory fallback in dev |
| SPA | React 19 · Vite · Tailwind CSS · Framer Motion · React Router · Axios |
| Deploy | **Supabase** (Postgres) · **Render** (API) · **Cloudflare Workers** (SPA static assets) |

---

## 📁 Repository structure

```
Toyota-Task-Incentive-Calculator/
├── README.md
├── PRD.md                      # original product requirements
├── render.yaml                 # Render Blueprint (API + build/seed)
├── backend/
│   ├── manage.py · requirements.txt · build.sh · Procfile
│   ├── config/settings/        # split base / dev / prod
│   ├── core/                   # shared permissions, pagination, cache, error handler
│   ├── accounts/               # custom User, JWT auth, RBAC, approval, seed_demo
│   ├── inventory/              # CarModel CRUD
│   ├── incentives/             # IncentiveSlab + engine.py (pure calc) + tests
│   └── sales/                  # MonthlySalesEntry, SalesLine, /calculate/, analytics, exports
└── frontend/
    ├── wrangler.jsonc          # Cloudflare Workers static-asset config (SPA routing)
    ├── vercel.json             # kept as a fallback host config
    └── src/
        ├── api/                # axios client + refresh interceptor + endpoints
        ├── auth/               # context, protected/role routes
        ├── components/         # design-system primitives, charts, ExportMenu, ThemeToggle, Toast
        ├── layout/             # responsive AppShell
        ├── lib/                # useDebounce, currency/format helpers
        └── features/{auth,admin,officer}/
```

---

## 🚀 Run locally

**Prerequisites:** Python 3.11+ and Node 18+.

### 1. Backend (API)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # defaults work out-of-the-box (SQLite, DEBUG=True)
python manage.py migrate
python manage.py seed_demo    # admin, officers, cars, slabs + ~9 months of history
python manage.py runserver    # → http://127.0.0.1:8000
```

> **Using Supabase / Postgres instead of SQLite?** Set `DATABASE_URL` in `backend/.env` to your Supabase connection string (Project Settings → Database → Connection string → URI). SSL is required by default. Everything else is identical.

> **Using Redis cache?** Set `CACHE_URL` or `REDIS_URL` in `backend/.env`, e.g. `redis://default:<password>@<host>:6379/0`. If blank, Django uses an in-process cache.

Run the test suite (33 tests across engine, RBAC/auth, sales rules & exports):

```bash
python manage.py test            # all apps
python manage.py test incentives # just the slab engine (20 tests)
```

### 2. Frontend (SPA)

```bash
cd frontend
npm install
cp .env.example .env            # points at http://127.0.0.1:8000/api
npm run dev                      # → http://localhost:5173
```

Open **http://localhost:5173** and sign in with the demo credentials below.

---

## 🔑 Demo credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@nippon.test` | `Admin@12345` |
| Sales Officer (approved) | `ravi.officer@nippon.test` | `Officer@12345` |
| Sales Officer (approved) | `meera.officer@nippon.test` | `Officer@12345` |
| Sales Officer (**pending**) | `pending.officer@nippon.test` | `Officer@12345` |

> Try logging in as the **pending** officer to see the blocked-login message, then approve them from the admin **Approvals** screen and log in successfully.

Reset / reseed anytime:

```bash
python manage.py seed_demo --clear   # wipe demo data
python manage.py seed_demo           # recreate with fresh multi-month history
```

---

## 🖥️ Features by role

### Admin
- **CRUD** for car inventory and incentive slabs, with a live slab editor that blocks overlaps/gaps before save.
- **Approvals** queue — approve/reject pending officer signups.
- **Analytics dashboard** — total payout/cars KPIs, **participation rate**, **at-risk officers** (lapsed loggers), **payout concentration** (top officer/model share), an **officer comparison table**, slab distribution, model mix, and month-over-month trend.
- **CSV export** — all officers, summary or per-model detail.

### Sales Officer
- **Log monthly sales** locked to the current month, per car model, with a live payout tracker (animated total, highlighted tier, per-model breakdown).
- **Personal analytics** — leaderboard **rank** & percentile, logging **streak**, **pace** vs. peers, **next-tier nudge** ("+₹X to reach the next tier this month"), YTD totals, best month, and a saved-months trend + tier history.
- **History page** and **CSV export** scoped strictly to their own data.

---

## 🧮 The Slab Engine (core business logic)

**Whole-slab model** — the total cars sold across *all* models selects a single slab; every car is paid at that slab's rate.

```
total_cars = Σ (cars sold per model line)
slab       = the slab whose inclusive [min, max] range contains total_cars
payout     = total_cars × slab.rate_per_car
```

Worked examples (default slabs `1–3 @ ₹1000`, `4–7 @ ₹2000`, `8+ @ ₹3500`):

| Cars sold | Slab | Payout |
|---|---|---|
| 2 | 1–3 | 2 × 1000 = **₹2,000** |
| 5 | 4–7 | 5 × 2000 = **₹10,000** |
| 8 | 8+ | 8 × 3500 = **₹28,000** |

**Design note — why whole-slab?** A marginal/progressive model (first 3 @ 1000, next 4 @ 2000, rest @ 3500) was considered. The assignment's wording *"8+ cars = 3500 per car"* implies the whole-slab reading, so that is the source of truth. The math lives in one pure function (`incentives/engine.py → calculate_incentive`), so switching to a progressive model is a one-function change — nothing else in the system needs to know.

**Edge cases handled & unit-tested:** 0 cars → ₹0 with a friendly empty state; counts above the top slab fall into the open-ended tier (`max = null`); inclusive boundaries (3 vs 4, 7 vs 8); negative/non-integer counts rejected by serializers; slab sets validated to start at 1 and be contiguous (no gaps/overlaps) at write time, so the calculator can never hit an undefined state.

---

## 🌐 API reference

All responses are JSON. Errors are normalised to `{ "detail": "...", "errors": { ... } }` with the correct HTTP status.

### Auth
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register/` | Public — officer signup (→ PENDING) |
| POST | `/api/auth/login/` | Public — JWT pair, only if APPROVED (else 403) |
| POST | `/api/auth/refresh/` | Public — refresh access token |
| GET  | `/api/auth/me/` | Authed — current user |

Sales officer registration requires a Nippon Toyota email (`@nippon.test`) and a unique employee code in the `SO-<serial>` format, e.g. `SO-104`. These rules are enforced by serializer validation and database constraints.

### Admin
| Method | Endpoint | Access |
|---|---|---|
| GET / POST | `/api/cars/` | read: authed · write: admin |
| GET/PUT/PATCH/DELETE | `/api/cars/{id}/` | admin |
| GET / POST | `/api/slabs/` | read: authed · write: admin |
| POST | `/api/slabs/validate/` | admin — dry-run overlap/gap check |
| PUT | `/api/slabs/bulk-replace/` | admin — atomic, validated full replace |
| GET | `/api/officers/?status=PENDING` | admin |
| POST | `/api/officers/{id}/approve/` · `/reject/` | admin |

### Sales Officer
| Method | Endpoint | Access |
|---|---|---|
| GET / POST | `/api/sales/` | approved officer (own data, **current month only**) |
| GET / PUT | `/api/sales/{month}/{year}/` | approved officer (own data) |
| POST | `/api/calculate/` | approved officer — stateless calc powering the live tracker |

`POST /api/calculate/` — request `{ lines: [{car_model, cars_sold}], month, year }` → response `{ total_cars, slab: {min_cars, max_cars, rate_per_car, label}, total_payout, matched, breakdown: [...] }`.

> Writing a `month`/`year` other than the current period returns **400** — past months are locked so analytics stay trustworthy. Historical data is created server-side via `seed_demo`.

### Analytics & export
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/analytics/admin/` | admin — KPIs, participation, at-risk, concentration, officer table, trend |
| GET | `/api/analytics/officer/` | approved officer — rank, streak, pace, next-tier, trend, tier history |
| GET | `/api/export/sales/` | authed — CSV; `?detail=summary` (default) or `?detail=lines`; admin sees all, officer scoped to self |

### Caching
The API caches read-heavy responses and lookup data:

- Admin/officer analytics: short TTL, invalidated when sales, slabs, inventory, or account approvals change.
- Car inventory, slab list, and officer list: cached with versioned keys, invalidated on admin writes.
- Calculator lookup data: current slabs and car-model names are cached, while the payout calculation itself remains request-accurate.

Production can use Redis via `CACHE_URL`; local development falls back to Django's local-memory cache.

---

## 🔒 Security

- JWT: short-lived access (15 min) + refresh (7 days) with rotation; role embedded in claims.
- DRF permission classes (`IsAdmin`, `IsApprovedSalesOfficer`, `IsAdminOrReadOnly`) enforce RBAC server-side on every endpoint. Officers' sales querysets are filtered to `request.user` — they can never read/write another officer's data.
- Passwords hashed with Django's PBKDF2 + min-length/common-password validators.
- Demo logins are **seeded as normal password-hashed users** and documented in the [Demo credentials](#-demo-credentials) table — the app never serves plaintext passwords or a public credential endpoint. Share them with evaluators out-of-band; override `DEMO_ADMIN_PASSWORD` / `DEMO_OFFICER_PASSWORD` for a private deployment.
- `DEBUG=False`, HSTS, secure cookies, and SSL redirect in production settings.
- CORS locked to the configured frontend origin in production; `SECRET_KEY`, `DATABASE_URL`, hosts, and CORS all come from env vars (never committed).

### Token storage tradeoff (honest disclosure)
The **access token is held in memory** (`sessionStorage`, cleared on tab close) and the **refresh token in `localStorage`** for a smooth reload experience. `localStorage` is readable by JavaScript, so it carries an **XSS exposure risk** versus an `httpOnly` refresh cookie. The cookie approach is more secure but adds same-site/CORS complexity across the Cloudflare↔Render origin split. The axios interceptor isolates this decision to one place (`src/api/client.js`), so hardening to an `httpOnly` cookie later touches only that module.

---

## ☁️ Deployment

Free, persistent stack: **Supabase** (Postgres) + **Render** (API) + **Cloudflare Workers** (SPA). Deploy in this order — each step produces a URL the next one needs.

### 1. Database → Supabase
1. [supabase.com](https://supabase.com) → **New project**. Set a database password and pick a region close to your Render region.
2. **Project Settings → Database → Connection string → URI** → choose the **Session pooler** (host like `aws-0-<region>.pooler.supabase.com`, port `5432`). Copy it and replace `[YOUR-PASSWORD]` with your DB password.
   - ⚠️ Do **not** use the direct `db.<ref>.supabase.co` host — it is IPv6-only and won't connect from Render's free tier. The session pooler is IPv4.

### 2. API → Render
1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. `render.yaml` creates the web service, runs `build.sh` (install → collectstatic → migrate → `seed_demo`), and starts Gunicorn with a `/api/health/` health check.
3. Set these env vars in the Render dashboard (the Blueprint marks them `sync: false`):
   - `DATABASE_URL` → the Supabase session-pooler URI from step 1.
   - `ALLOWED_HOSTS` → your Render host, e.g. `nippon-incentive-api-0rzk.onrender.com`.
   - `CORS_ALLOWED_ORIGINS` → leave blank for now; fill after step 3.
4. Deploy. Confirm `https://<your-render-host>/api/health/` returns `{"status":"ok"}`.

### 3. SPA → Cloudflare (Workers static assets)
1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Import a repository** → authorize GitHub and pick this repo.
2. Build settings:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
3. Add a **build variable**: `VITE_API_BASE_URL` = `https://<your-render-host>/api`.
4. **Create / Deploy.** `frontend/wrangler.jsonc` uploads `dist/` as static assets with `not_found_handling: "single-page-application"`, so client routes like `/admin` resolve without a `_redirects` file. You'll get a `https://<project>.<account>.workers.dev` URL.

### 4. Wire the two together
1. Back in Render, set `CORS_ALLOWED_ORIGINS` = your `https://<project>.<account>.workers.dev` URL → **Save** (triggers a redeploy).
2. Open the Workers URL and log in with the [demo credentials](#-demo-credentials).

### 5. Keep the free API warm (avoid cold starts)
Render free web services sleep after ~15 min idle (next request waits ~30–60s). Point a free uptime monitor — [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org) — at `https://<your-render-host>/api/health/` every 5–10 minutes so evaluators never hit a cold start.

> Changing the frontend host? `VITE_API_BASE_URL` is the only required env var and the build is always `npm run build` → `dist`. SPA routing is handled by `wrangler.jsonc` (Cloudflare) or `vercel.json` (Vercel, kept in-repo as a fallback).

---

## ✅ Definition of Done checklist

- [x] Slab engine unit-tested (20 tests) — matches worked examples exactly.
- [x] Admin CRUD for cars & slabs; slab editor blocks overlaps/gaps live.
- [x] Officer signup → pending → admin approves → officer logs in.
- [x] Real-time payout updates as volumes change.
- [x] RBAC enforced server-side (verified: officer → admin endpoints return 403).
- [x] Analytics dashboards for both admin and officer roles.
- [x] Current-month-only logging enforced + per-line audit timestamps.
- [x] CSV export (summary & per-model) scoped by role.
- [x] Light/dark theme, light by default, persisted per user.
- [x] Responsive on mobile + desktop; loading/empty/error states throughout.
- [x] Seed data with multi-month history for a graph-rich one-click demo.
- [x] Deployed: Supabase + Render Blueprint + Cloudflare Workers, with env templates.
