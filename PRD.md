# Product Requirements Document (PRD)
## Smart Incentive Calculator with Dynamic Slab Admin Panel
**Nippon Toyota — Internship Practical Evaluation, Task 2**

**Version:** 1.0 (Production-Ready)
**Stack:** Django REST Framework (API) + React (SPA) + PostgreSQL
**Author:** [Your Name]
**Target:** Live deployment + public GitHub repo, graded out of 100.

---

## 1. Overview & Goal

A role-based web application that calculates **tiered, slab-wise monthly incentives** for vehicle Sales Officers, where an Admin defines the pricing model (car inventory + incentive slabs) and Sales Officers log monthly sales to see their real-time projected payout.

**Why this task:** All business logic is self-contained and fully testable locally — no external dependency (no SMTP, no third-party PDF service) that can break a live demo. This maximizes the 40% "Functional Completeness" score while leaving generous surface area for the 20% UI/UX score.

### Success Criteria (mapped to the 100-point rubric)
| Rubric Criteria | Weight | How this PRD wins it |
|---|---|---|
| Functional Completeness | 40% | Every feature self-contained & testable; no uncaught console errors; defensive API error handling |
| Code Quality & Architecture | 20% | Modular Django apps, DRF serializers/viewsets, typed React components, clear folder structure |
| UI/UX Experience | 20% | Responsive (mobile + desktop), Tailwind design system, real-time interactivity, empty/loading/error states |
| Deployment | 20% | Live URL (Render API + Vercel SPA), thorough README, seed data, one-click sample |

---

## 2. User Roles & RBAC

Two roles, enforced at the API layer (not just hidden in the UI):

### Role A — Admin (Configuration Engine)
- Manage **Car Inventory** (CRUD): Model Name, Base Suffix, Variant.
- Manage **Incentive Slabs** (CRUD): min cars, max cars (nullable = "and above"), rate per car.
- **Approve / reject** pending Sales Officer signups.
- View all Sales Officers' submitted monthly sales (read-only oversight).

### Role B — Sales Officer (Calculation Dashboard)
- Public signup → account starts as **PENDING** (cannot log in to dashboard until approved).
- After admin approval → secure login.
- Select a month, log cars sold per model line.
- **Real-time tracker:** as volumes change, the UI shows the slab tier hit and the exact total payout for the month.

### Account State Machine
```
PENDING ──approve──▶ APPROVED ──(can log in)
   │
   └──reject──▶ REJECTED  (login blocked, shown a message)
```

### Auth: JWT (access + refresh)
- `POST /api/auth/register/` → creates user, role=SALES_OFFICER, status=PENDING.
- `POST /api/auth/login/` → returns access + refresh **only if** status=APPROVED (else 403 with clear message).
- `POST /api/auth/refresh/` → new access token.
- Access token in memory + refresh token in httpOnly cookie (or localStorage with documented tradeoff — see Security section).
- Role embedded in JWT claims; DRF permission classes (`IsAdmin`, `IsApprovedSalesOfficer`) gate every endpoint.
- Admin account seeded via Django management command (no public admin signup).

---

## 3. The Slab Engine (Core Business Logic)

### Calculation Rule — **Whole-slab model** (matches the assignment's literal example)
The total number of cars sold across **all models** determines a single slab. Every car is then paid at that slab's rate.

```
total_cars = Σ (cars sold per model line)
slab       = the slab whose [min, max] range contains total_cars
payout     = total_cars × slab.rate_per_car
```

**Worked example (assignment's default slabs):**
| Cars Sold | Slab | Rate/car | Payout |
|---|---|---|---|
| 2 | 1–3 | 1000 | 2 × 1000 = **2,000** |
| 5 | 4–7 | 2000 | 5 × 2000 = **10,000** |
| 8 | 8+  | 3500 | 8 × 3500 = **28,000** |

> **Design note (put this in README):** A "marginal/progressive" model (first 3 @ 1000, next 4 @ 2000, rest @ 3500) was considered. The assignment's wording "*8+ cars = 3500 per car*" implies the whole-slab reading, so that is implemented as the source of truth. The architecture isolates calculation in a single pure function (`calculate_incentive`) so the model can be swapped with a one-line change — demonstrating extensibility.

### Edge cases the engine MUST handle
- 0 cars → payout 0, no slab, friendly "no sales logged" state.
- Cars value above the top slab's range → falls into the open-ended top slab (max=null).
- Gaps/overlaps in admin-defined slabs → validation prevents saving overlapping or gapped ranges; if a value somehow matches no slab, API returns a clear error and UI shows it.
- Negative or non-integer car counts → rejected by serializer validation.
- Exactly one slab boundary (e.g., 3 vs 4) → boundaries are inclusive on min, inclusive on max; unit-tested.

---

## 4. Data Model (PostgreSQL)

```
User (extends Django AbstractUser)
  - role: enum {ADMIN, SALES_OFFICER}
  - status: enum {PENDING, APPROVED, REJECTED}   # admins are auto-APPROVED
  - employee_code: string (optional)

CarModel
  - id
  - model_name: string
  - base_suffix: string
  - variant: string
  - is_active: bool
  - created_at / updated_at

IncentiveSlab
  - id
  - min_cars: int                 # inclusive
  - max_cars: int | null          # inclusive; null = open-ended top tier
  - rate_per_car: decimal
  - ordering enforced; validated non-overlapping, non-gapped

MonthlySalesEntry
  - id
  - sales_officer: FK(User)
  - month: int (1-12)
  - year: int
  - created_at / updated_at
  - UNIQUE(sales_officer, month, year)   # one entry per officer per month

SalesLine
  - id
  - entry: FK(MonthlySalesEntry)
  - car_model: FK(CarModel)
  - cars_sold: int (>= 0)
  - UNIQUE(entry, car_model)
```

---

## 5. API Specification (Django REST Framework)

All responses JSON. All errors return `{ "detail": "...", "errors": {...} }` with correct HTTP status.

### Auth
| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register/` | Public | Sales Officer signup (→ PENDING) |
| POST | `/api/auth/login/` | Public | Returns JWT pair if APPROVED |
| POST | `/api/auth/refresh/` | Public | Refresh access token |
| GET  | `/api/auth/me/` | Authed | Current user + role + status |

### Admin — Car Inventory
| Method | Endpoint | Role |
|---|---|---|
| GET/POST | `/api/cars/` | Admin (write), Authed (read) |
| GET/PUT/PATCH/DELETE | `/api/cars/{id}/` | Admin |

### Admin — Slabs
| Method | Endpoint | Role |
|---|---|---|
| GET/POST | `/api/slabs/` | Admin (write), Authed (read) |
| GET/PUT/PATCH/DELETE | `/api/slabs/{id}/` | Admin |
| POST | `/api/slabs/validate/` | Admin (dry-run overlap/gap check) |

### Admin — Officer Approval
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/officers/?status=PENDING` | Admin |
| POST | `/api/officers/{id}/approve/` | Admin |
| POST | `/api/officers/{id}/reject/` | Admin |

### Sales Officer — Sales & Calculation
| Method | Endpoint | Role |
|---|---|---|
| GET/POST | `/api/sales/` | Approved Officer (own data only) |
| GET/PUT | `/api/sales/{month}/{year}/` | Approved Officer (own data) |
| POST | `/api/calculate/` | Approved Officer — stateless calc: send lines, get tier+payout breakdown |

`POST /api/calculate/` powers the **real-time tracker**: the React UI calls it (debounced) as the officer types, so the server's single source of truth does the math. Request: `{ lines: [{car_model, cars_sold}], month, year }`. Response: `{ total_cars, slab: {min,max,rate}, total_payout, breakdown: [...] }`.

---

## 6. Frontend (React SPA) — Screen Inventory

> Frontend is your strong side — this is where the 20% UI/UX points live. Each screen ships with **loading, empty, error, and success states**.

### Shared
- **Design system:** Tailwind, Toyota-adjacent palette (red `#EB0A1E` accent, neutral grays, white), Inter/system font, 8px spacing scale, rounded-xl cards, subtle shadows.
- **Layout:** responsive sidebar (collapses to bottom nav on mobile), top bar with user/role chip + logout.
- **Components:** Button, Input, Select, Table, Modal, Toast, Badge, EmptyState, Skeleton loader, ConfirmDialog.
- **Routing:** protected routes by role; unauthorized → redirect with message.

### Auth screens
1. **Login** — email/password, error on pending/rejected with clear messaging.
2. **Register** — Sales Officer signup → "Your account is pending admin approval" confirmation.

### Admin screens
3. **Admin Dashboard** — summary cards (cars count, slabs count, pending officers), quick links.
4. **Car Inventory** — table + add/edit modal + delete confirm; inline validation.
5. **Slab Editor** — the showpiece. Visual tiered layout (rows: min–max → rate/car), add/remove tiers, live overlap/gap warnings, "Save" disabled until valid. Visual band/gradient showing the tiers.
6. **Officer Approvals** — pending queue with Approve/Reject; optimistic UI + toast.

### Sales Officer screens
7. **Officer Dashboard** — month/year selector, per-model input rows, **real-time payout panel** (sticky on desktop, bottom sheet on mobile) showing: total cars, slab hit (with the tier highlighted), total payout, per-model breakdown. Debounced calls to `/api/calculate/`.
8. **History** (nice-to-have, build only if time) — past months' submissions.

---

## 7. Seed Data (one-click demo)

A management command `python manage.py seed_demo` (and a "Load Sample Data" button behind admin, removable via `seed_demo --clear`) creates:
- 1 Admin (`admin@nippon.test` / documented password).
- 2 approved Sales Officers + 1 pending (to demo the approval queue live).
- ~5 car models (realistic Toyota-style names/variants).
- The 3 default slabs (1–3 @ 1000, 4–7 @ 2000, 8+ @ 3500).
- One officer with a pre-filled month so graders see a populated dashboard instantly.

This directly serves the **Deployment 20%** — graders open the URL and immediately see a working, populated app.

---

## 8. Security & Production Hardening

- JWT short-lived access (15 min) + refresh (7 days) with rotation.
- Passwords via Django's PBKDF2 hasher; min-length + common-password validators.
- DRF permission classes enforce RBAC server-side on **every** endpoint (never trust the client).
- Officers can only ever read/write **their own** sales (queryset filtered by `request.user`).
- CORS locked to the deployed frontend origin.
- Env vars for `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, CORS origins — never committed.
- `DEBUG=False` in production; proper `ALLOWED_HOSTS`.
- Slab validation prevents overlaps/gaps at write time → calculation never hits an undefined state.
- Input validation on all serializers (non-negative ints, valid month/year, etc.).

> **Token storage note for README:** access token in memory, refresh in httpOnly cookie is the most secure; if time forces localStorage, document the XSS tradeoff honestly. Graders reward the awareness.

---

## 9. Repository & Folder Structure

```
nippon-incentive-calculator/
├── README.md                  # setup, env, run locally, deploy, design notes
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                # settings (split base/prod), urls, wsgi
│   ├── accounts/              # User, auth, RBAC, approval
│   ├── inventory/             # CarModel
│   ├── incentives/            # IncentiveSlab + calculate_incentive() pure fn + tests
│   ├── sales/                 # MonthlySalesEntry, SalesLine, calculate endpoint
│   └── core/                  # shared permissions, pagination, error handlers
└── frontend/
    ├── package.json
    ├── src/
    │   ├── api/               # axios client, interceptors (refresh), endpoints
    │   ├── auth/              # context, protected routes, role guards
    │   ├── components/        # design-system primitives
    │   ├── features/
    │   │   ├── admin/         # cars, slabs, approvals
    │   │   └── officer/       # dashboard, calculator
    │   └── lib/               # hooks (useDebounce), formatters (currency)
    └── tailwind.config.js
```

---

## 10. Build Order (optimized for 1–2 days, solo)

**Day 1 — Backend foundation + core logic (de-risk first):**
1. Django project, custom User (role + status), Postgres connection.
2. JWT auth (register/login/refresh/me) + RBAC permission classes.
3. `calculate_incentive()` pure function + **unit tests** (this is the heart — test it first).
4. Car + Slab models, serializers, viewsets, slab overlap/gap validation.
5. Sales models + `/api/calculate/` endpoint.
6. Seed command. Deploy API to Render early (catch deploy issues on day 1, not hour 47).

**Day 2 — Frontend + polish + deploy:**
7. Design system primitives + auth flow + protected routing.
8. Admin: cars, slab editor (showpiece), approvals.
9. Officer: dashboard + real-time calculator (debounced).
10. Empty/loading/error states everywhere; responsive pass (mobile + desktop).
11. Deploy SPA to Vercel, wire CORS, smoke-test the live URL with seed data.
12. README: setup, env vars, deploy steps, design decisions, demo credentials, screenshots.

---

## 11. Definition of Done (pre-submission checklist)

- [ ] Live URL loads with seed data, no console errors.
- [ ] Admin can CRUD cars and slabs; slab editor blocks overlaps/gaps.
- [ ] Officer signup → pending → admin approves → officer logs in.
- [ ] Real-time payout updates as volumes change; matches worked examples exactly.
- [ ] RBAC enforced server-side (officer cannot hit admin endpoints — verify with a token swap).
- [ ] Responsive on mobile + desktop.
- [ ] All API errors handled gracefully in UI (no white screens).
- [ ] README complete with demo credentials + deploy instructions.
- [ ] `calculate_incentive` unit tests pass.
- [ ] Repo public, clean commit history.
