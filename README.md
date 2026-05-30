# Nippon Toyota — Smart Incentive Calculator

A role-based web app that computes **tiered, slab-wise monthly incentives** for vehicle Sales Officers. Admins define the pricing model (car inventory + incentive slabs); Sales Officers log monthly sales and watch their projected payout update **in real time**.

> Internship Practical Evaluation · Task 2 — Django REST Framework + React + PostgreSQL.

---

## ✨ Highlights

- **Whole-slab incentive engine** isolated in a single pure, unit-tested function (`calculate_incentive`) — swappable to a progressive model in one line.
- **Server-enforced RBAC** with JWT — Admin vs. Approved Sales Officer, gated on *every* endpoint (not just hidden in the UI).
- **Account approval state machine** — public signup → `PENDING` → admin approves → login enabled. Rejected/pending logins are blocked with a clear `403`.
- **Live slab validation** — overlaps/gaps are impossible by construction in the editor and verified by the server (dry-run + atomic bulk replace).
- **Real-time payout tracker** — debounced calls to the server's single source of truth as the officer types; animated payout, highlighted tier, per-model breakdown.
- **Premium responsive UI** — Toyota-red accent on a dark command console, Archivo display type with tabular figures, loading/empty/error states everywhere, mobile bottom-nav.
- **One-command seed** for an instantly populated demo.

---

## 🧱 Tech Stack

| Layer | Choice |
|---|---|
| API | Django 5.2 · Django REST Framework · SimpleJWT |
| DB | PostgreSQL (via `DATABASE_URL`) — falls back to **SQLite** locally with zero setup |
| Cache | Django cache framework · Redis via `CACHE_URL` in production · local-memory fallback in dev |
| SPA | React 19 · Vite · Tailwind CSS · Framer Motion · React Router · Axios |
| Deploy | Render (API + Postgres) · Vercel (SPA) |

---

## 📁 Repository structure

```
nippon-incentive-calculator/
├── README.md
├── render.yaml                 # Render Blueprint (API + Postgres)
├── backend/
│   ├── manage.py · requirements.txt · build.sh · Procfile
│   ├── config/settings/        # split base / dev / prod
│   ├── core/                   # shared permissions, pagination, error handler
│   ├── accounts/               # custom User, JWT auth, RBAC, approval, seed_demo
│   ├── inventory/              # CarModel CRUD
│   ├── incentives/             # IncentiveSlab + engine.py (pure calc) + tests
│   └── sales/                  # MonthlySalesEntry, SalesLine, /calculate/
└── frontend/
    ├── vercel.json
    └── src/
        ├── api/                # axios client + refresh interceptor + endpoints
        ├── auth/               # context, protected/role routes
        ├── components/         # design-system primitives, Toast, Modal
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
python manage.py seed_demo    # creates admin, officers, cars, slabs, a prefilled month
python manage.py runserver    # → http://127.0.0.1:8000
```

> **Using Supabase / Postgres instead of SQLite?** Just set `DATABASE_URL` in `backend/.env` to your Supabase connection string (Project Settings → Database → Connection string → URI). SSL is required by default. Everything else is identical.

> **Using Redis cache?** Set `CACHE_URL` or `REDIS_URL` in `backend/.env`, for example `redis://default:<password>@<host>:6379/0`. If it is blank, Django uses an in-process cache that still improves repeated reads during local development.

Run the engine unit tests:

```bash
python manage.py test incentives
```

### 2. Frontend (SPA)

```bash
cd frontend
npm install
cp .env.example .env           # points at http://127.0.0.1:8000/api
npm run dev                     # → http://localhost:5173
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
python manage.py seed_demo           # recreate
```

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

Sales officer registration requires a Nippon Toyota email (`@nippon.test`) and
a unique employee code in the `SO-<serial number>` format, for example
`SO-104`. These rules are enforced by serializer validation and database
constraints.

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
| GET / POST | `/api/sales/` | approved officer (own data) |
| GET / PUT | `/api/sales/{month}/{year}/` | approved officer (own data) |
| POST | `/api/calculate/` | approved officer — stateless calc powering the live tracker |

`POST /api/calculate/` — request `{ lines: [{car_model, cars_sold}], month, year }` → response `{ total_cars, slab: {min_cars, max_cars, rate_per_car, label}, total_payout, matched, breakdown: [...] }`.

### Caching
The API caches read-heavy responses and lookup data:

- Admin/officer analytics: short TTL, invalidated when sales, slabs, inventory, or account approvals change.
- Car inventory, slab list, and officer list: cached with versioned keys and invalidated on admin writes.
- Calculator lookup data: current slabs and car-model names are cached, while the payout calculation itself remains request-accurate.

Production can use Redis by setting `CACHE_URL`; local development falls back to Django's local-memory cache.

---

## 🔒 Security

- JWT: short-lived access (15 min) + refresh (7 days) with rotation; role embedded in claims.
- DRF permission classes (`IsAdmin`, `IsApprovedSalesOfficer`, `IsAdminOrReadOnly`) enforce RBAC server-side on every endpoint. Officers' sales querysets are filtered to `request.user` — they can never read/write another officer's data.
- Passwords hashed with Django's PBKDF2 + min-length/common-password validators.
- Login-page demo credentials are fetched from database-backed helper rows and returned only when the linked Supabase user is active, approved, and the displayed password authenticates against the user's password hash. Set `DEMO_CREDENTIALS_ENABLED=False` to hide the helper in a private deployment.
- `DEBUG=False`, HSTS, secure cookies, and SSL redirect in production settings.
- CORS locked to the configured frontend origin in production; `SECRET_KEY`, `DATABASE_URL`, hosts, and CORS all come from env vars (never committed).

### Token storage tradeoff (honest disclosure)
The **access token is held in memory** (`sessionStorage`, cleared on tab close) and the **refresh token in `localStorage`** for a smooth reload experience. `localStorage` is readable by JavaScript, so it carries an **XSS exposure risk** versus an `httpOnly` refresh cookie. The cookie approach is more secure but adds same-site/CORS complexity across the Vercel↔Render origin split. The axios interceptor isolates this decision to one place (`src/api/client.js`), so hardening to an `httpOnly` cookie later touches only that module.

---

## ☁️ Deployment

### API → Render
1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. `render.yaml` provisions the web service **and** a free Postgres instance, runs `build.sh` (install → collectstatic → migrate → `seed_demo`), and starts Gunicorn.
3. After the first deploy, set:
   - `ALLOWED_HOSTS` → your Render host (e.g. `nippon-incentive-api.onrender.com`)
   - `CORS_ALLOWED_ORIGINS` → your Vercel URL (e.g. `https://your-app.vercel.app`)
   - `DEMO_ADMIN_PASSWORD` and `DEMO_OFFICER_PASSWORD` if you want to override the visible demo logins.

### SPA → Vercel
1. Vercel → **New Project** → import the repo, set **Root Directory** to `frontend`.
2. Add env var `VITE_API_BASE_URL` = `https://<your-render-host>/api`.
3. Deploy. `vercel.json` handles the SPA rewrite so client-side routes resolve.

---

## ✅ Definition of Done checklist

- [x] Slab engine unit-tested (17 tests) — matches worked examples exactly.
- [x] Admin CRUD for cars & slabs; slab editor blocks overlaps/gaps live.
- [x] Officer signup → pending → admin approves → officer logs in.
- [x] Real-time payout updates as volumes change.
- [x] RBAC enforced server-side (verified: officer → admin endpoints return 403).
- [x] Responsive on mobile + desktop; loading/empty/error states throughout.
- [x] Seed data for a one-click populated demo.
- [x] Deploy-ready (Render Blueprint + Vercel config + env templates).
