from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum

from accounts.models import AccountStatus, Role
from inventory.models import CarModel

from .models import MonthlySalesEntry, SalesLine
from .services import compute_payout

MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]


def _money(value) -> str:
    return str(Decimal(value).quantize(Decimal("0.01")))


def _trend_delta(sorted_rows) -> dict:
    """Month-over-month payout movement from chronologically sorted rows.

    Each row must carry a Decimal ``total_payout``. Returns a small, JSON-ready
    summary the dashboards render as a trend chip.
    """
    if len(sorted_rows) < 2:
        return {
            "mom_delta": "0.00",
            "mom_pct": None,
            "mom_direction": "flat",
            "prev_label": "",
        }
    latest = Decimal(sorted_rows[-1]["total_payout"])
    prev = Decimal(sorted_rows[-2]["total_payout"])
    delta = latest - prev
    if delta > 0:
        direction = "up"
    elif delta < 0:
        direction = "down"
    else:
        direction = "flat"
    pct = float((delta / prev * 100).quantize(Decimal("0.1"))) if prev > 0 else None
    return {
        "mom_delta": _money(delta),
        "mom_pct": pct,
        "mom_direction": direction,
        "prev_label": sorted_rows[-2].get("label", ""),
    }


def _full_name(user) -> str:
    name = f"{user.first_name} {user.last_name}".strip()
    return name or user.email


def _entry_lines(entry):
    return [
        {"car_model": line.car_model_id, "cars_sold": line.cars_sold}
        for line in entry.lines.all()
    ]


def _entry_calc(entry):
    calc = compute_payout(_entry_lines(entry))
    slab_label = calc["slab"]["label"] if calc.get("slab") else "No tier"
    return int(calc["total_cars"]), Decimal(str(calc["total_payout"])), slab_label


def build_admin_analytics() -> dict:
    """Aggregate the existing database into admin dashboard metrics."""

    User = get_user_model()
    entries = list(
        MonthlySalesEntry.objects.select_related("sales_officer")
        .prefetch_related("lines__car_model")
        .order_by("-year", "-month", "-updated_at")
    )

    total_cars = 0
    total_payout = Decimal("0")
    monthly = {}
    officers = {}
    slabs = defaultdict(
        lambda: {"label": "", "entries": 0, "cars": 0, "total_payout": Decimal("0")}
    )
    recent_entries = []
    current = date.today()
    current_month_officer_ids = set()

    for entry in entries:
        entry_cars, entry_payout, slab_label = _entry_calc(entry)

        total_cars += entry_cars
        total_payout += entry_payout

        month_key = (entry.year, entry.month)
        if month_key not in monthly:
            monthly[month_key] = {
                "year": entry.year,
                "month": entry.month,
                "label": f"{MONTH_NAMES[entry.month - 1]} {entry.year}",
                "cars": 0,
                "submissions": 0,
                "total_payout": Decimal("0"),
            }
        monthly[month_key]["cars"] += entry_cars
        monthly[month_key]["submissions"] += 1
        monthly[month_key]["total_payout"] += entry_payout

        officer = entry.sales_officer
        if officer.id not in officers:
            # Entries are ordered newest-first, so first sight = latest activity.
            officers[officer.id] = {
                "id": officer.id,
                "name": _full_name(officer),
                "email": officer.email,
                "employee_code": officer.employee_code,
                "cars": 0,
                "submissions": 0,
                "total_payout": Decimal("0"),
                "last_active": f"{MONTH_NAMES[entry.month - 1]} {entry.year}",
            }
        officers[officer.id]["cars"] += entry_cars
        officers[officer.id]["submissions"] += 1
        officers[officer.id]["total_payout"] += entry_payout

        if entry.year == current.year and entry.month == current.month:
            current_month_officer_ids.add(officer.id)

        slabs[slab_label]["label"] = slab_label
        slabs[slab_label]["entries"] += 1
        slabs[slab_label]["cars"] += entry_cars
        slabs[slab_label]["total_payout"] += entry_payout

        if len(recent_entries) < 6:
            recent_entries.append(
                {
                    "id": entry.id,
                    "officer": _full_name(officer),
                    "email": officer.email,
                    "month": entry.month,
                    "year": entry.year,
                    "label": f"{MONTH_NAMES[entry.month - 1]} {entry.year}",
                    "cars": entry_cars,
                    "slab": slab_label,
                    "total_payout": _money(entry_payout),
                }
            )

    model_mix = [
        {
            "car_model": row["car_model_id"],
            "model": row["car_model__model_name"],
            "variant": row["car_model__variant"],
            "cars": row["cars"] or 0,
            "submissions": row["submissions"],
        }
        for row in SalesLine.objects.values(
            "car_model_id",
            "car_model__model_name",
            "car_model__variant",
        )
        .annotate(cars=Sum("cars_sold"), submissions=Count("entry", distinct=True))
        .order_by("-cars", "car_model__model_name")[:8]
    ]

    status_counts = {
        status: 0
        for status in (
            AccountStatus.PENDING,
            AccountStatus.APPROVED,
            AccountStatus.REJECTED,
        )
    }
    for row in (
        User.objects.filter(role=Role.SALES_OFFICER)
        .values("status")
        .annotate(count=Count("id"))
    ):
        status_counts[row["status"]] = row["count"]

    current_month = monthly.get(
        (current.year, current.month),
        {
            "year": current.year,
            "month": current.month,
            "label": f"{MONTH_NAMES[current.month - 1]} {current.year}",
            "cars": 0,
            "submissions": 0,
            "total_payout": Decimal("0"),
        },
    )

    submission_count = len(entries)
    active_models = CarModel.objects.filter(is_active=True).count()
    total_models = CarModel.objects.count()

    chronological = sorted(monthly.values(), key=lambda r: (r["year"], r["month"]))
    trend = _trend_delta(chronological)
    ytd_cars = sum(r["cars"] for r in monthly.values() if r["year"] == current.year)
    ytd_payout = sum(
        (r["total_payout"] for r in monthly.values() if r["year"] == current.year),
        Decimal("0"),
    )
    active_officers = len(officers)

    # --- Participation + at-risk officers (approved but no entry this month) ---
    approved_rows = list(
        User.objects.filter(
            role=Role.SALES_OFFICER, status=AccountStatus.APPROVED
        ).values("id", "first_name", "last_name", "email", "employee_code")
    )
    approved_total = len(approved_rows)
    submitted_this_month = len(current_month_officer_ids)
    participation_rate = (
        round(submitted_this_month / approved_total * 100) if approved_total else 0
    )
    at_risk_officers = []
    for row in approved_rows:
        if row["id"] in current_month_officer_ids:
            continue
        agg = officers.get(row["id"])
        name = f'{row["first_name"]} {row["last_name"]}'.strip() or row["email"]
        at_risk_officers.append(
            {
                "id": row["id"],
                "name": name,
                "email": row["email"],
                "employee_code": row["employee_code"],
                "last_active": agg["last_active"] if agg else "Never",
                "lifetime_payout": _money(agg["total_payout"]) if agg else "0.00",
            }
        )
    at_risk_officers.sort(key=lambda r: r["last_active"] == "Never", reverse=True)

    # --- Payout concentration (risk lens) ---
    ranked_officers = sorted(
        officers.values(), key=lambda r: (r["total_payout"], r["cars"]), reverse=True
    )

    def _share(part, whole):
        return round(float(Decimal(part) / Decimal(whole) * 100), 1) if whole else 0.0

    top_officer_share = (
        _share(ranked_officers[0]["total_payout"], total_payout) if ranked_officers else 0.0
    )
    top3_officer_share = (
        _share(sum((o["total_payout"] for o in ranked_officers[:3]), Decimal("0")), total_payout)
        if ranked_officers
        else 0.0
    )
    top_model_share = _share(model_mix[0]["cars"], total_cars) if model_mix and total_cars else 0.0

    return {
        "summary": {
            "total_cars": total_cars,
            "total_payout": _money(total_payout),
            "submissions": submission_count,
            "avg_cars_per_submission": round(total_cars / submission_count, 1)
            if submission_count
            else 0,
            "avg_payout_per_officer": _money(total_payout / active_officers)
            if active_officers
            else "0.00",
            "active_officers": active_officers,
            "active_models": active_models,
            "retired_models": max(total_models - active_models, 0),
            "approved_officers": status_counts[AccountStatus.APPROVED],
            "pending_officers": status_counts[AccountStatus.PENDING],
            "participation_rate": participation_rate,
            "participation_submitted": submitted_this_month,
            "participation_total": approved_total,
            "ytd_cars": ytd_cars,
            "ytd_payout": _money(ytd_payout),
            "ytd_year": current.year,
            **trend,
        },
        "payout_concentration": {
            "top_officer": ranked_officers[0]["name"] if ranked_officers else None,
            "top_officer_share": top_officer_share,
            "top3_officer_share": top3_officer_share,
            "top_model": model_mix[0]["model"] if model_mix else None,
            "top_model_share": top_model_share,
        },
        "at_risk_officers": at_risk_officers,
        "officer_table": [
            {
                "id": o["id"],
                "name": o["name"],
                "email": o["email"],
                "employee_code": o["employee_code"],
                "cars": o["cars"],
                "submissions": o["submissions"],
                "avg_cars": round(o["cars"] / o["submissions"], 1) if o["submissions"] else 0,
                "last_active": o["last_active"],
                "total_payout": _money(o["total_payout"]),
            }
            for o in ranked_officers
        ],
        "monthly_comparison": [
            {**row, "total_payout": _money(row["total_payout"])}
            for row in sorted(monthly.values(), key=lambda r: (r["year"], r["month"]))[-12:]
        ],
        "current_month": {
            **current_month,
            "total_payout": _money(current_month["total_payout"]),
        },
        "monthly_trend": [
            {**row, "total_payout": _money(row["total_payout"])}
            for row in sorted(monthly.values(), key=lambda r: (r["year"], r["month"]))[-6:]
        ],
        "officer_leaderboard": [
            {**row, "total_payout": _money(row["total_payout"])}
            for row in sorted(
                officers.values(),
                key=lambda r: (r["total_payout"], r["cars"]),
                reverse=True,
            )[:5]
        ],
        "model_mix": model_mix,
        "slab_distribution": [
            {**row, "total_payout": _money(row["total_payout"])}
            for row in sorted(
                slabs.values(),
                key=lambda r: (r["cars"], r["total_payout"]),
                reverse=True,
            )
        ],
        "approval_pipeline": [
            {
                "status": status,
                "label": status.title(),
                "count": status_counts[status],
            }
            for status in (
                AccountStatus.PENDING,
                AccountStatus.APPROVED,
                AccountStatus.REJECTED,
            )
        ],
        "inventory_status": [
            {"label": "Active", "count": active_models},
            {"label": "Retired", "count": max(total_models - active_models, 0)},
        ],
        "recent_entries": recent_entries,
    }


def build_officer_analytics(user) -> dict:
    """Aggregate analytics for the signed-in sales officer only."""

    entries = list(
        MonthlySalesEntry.objects.filter(sales_officer=user)
        .select_related("sales_officer")
        .prefetch_related("lines__car_model")
        .order_by("-year", "-month", "-updated_at")
    )

    total_cars = 0
    total_payout = Decimal("0")
    monthly = []
    slabs = defaultdict(
        lambda: {"label": "", "entries": 0, "cars": 0, "total_payout": Decimal("0")}
    )
    recent_entries = []
    best_month = None

    for entry in entries:
        entry_cars, entry_payout, slab_label = _entry_calc(entry)
        row = {
            "id": entry.id,
            "year": entry.year,
            "month": entry.month,
            "label": f"{MONTH_NAMES[entry.month - 1]} {entry.year}",
            "cars": entry_cars,
            "slab": slab_label,
            "total_payout": entry_payout,
        }

        total_cars += entry_cars
        total_payout += entry_payout
        monthly.append(row)

        slabs[slab_label]["label"] = slab_label
        slabs[slab_label]["entries"] += 1
        slabs[slab_label]["cars"] += entry_cars
        slabs[slab_label]["total_payout"] += entry_payout

        if best_month is None or (
            entry_payout,
            entry_cars,
        ) > (
            best_month["total_payout"],
            best_month["cars"],
        ):
            best_month = row

        if len(recent_entries) < 5:
            recent_entries.append({**row, "total_payout": _money(entry_payout)})

    model_mix = [
        {
            "car_model": row["car_model_id"],
            "model": row["car_model__model_name"],
            "variant": row["car_model__variant"],
            "cars": row["cars"] or 0,
            "submissions": row["submissions"],
        }
        for row in SalesLine.objects.filter(entry__sales_officer=user)
        .values(
            "car_model_id",
            "car_model__model_name",
            "car_model__variant",
        )
        .annotate(cars=Sum("cars_sold"), submissions=Count("entry", distinct=True))
        .order_by("-cars", "car_model__model_name")[:8]
    ]

    current = date.today()
    current_month = next(
        (
            row
            for row in monthly
            if row["year"] == current.year and row["month"] == current.month
        ),
        {
            "id": None,
            "year": current.year,
            "month": current.month,
            "label": f"{MONTH_NAMES[current.month - 1]} {current.year}",
            "cars": 0,
            "slab": "No tier",
            "total_payout": Decimal("0"),
        },
    )

    submission_count = len(entries)
    avg_cars = round(total_cars / submission_count, 1) if submission_count else 0

    chronological = sorted(monthly, key=lambda r: (r["year"], r["month"]))
    trend = _trend_delta(chronological)
    ytd_cars = sum(r["cars"] for r in monthly if r["year"] == current.year)
    ytd_payout = sum(
        (r["total_payout"] for r in monthly if r["year"] == current.year),
        Decimal("0"),
    )

    # --- Peer rank (by total cars sold, across all officers who have logged) ---
    all_totals = list(
        SalesLine.objects.values("entry__sales_officer")
        .annotate(cars=Sum("cars_sold"))
        .order_by("-cars")
    )
    rank_total = len(all_totals)
    if submission_count and total_cars > 0 and rank_total:
        higher = sum(1 for t in all_totals if (t["cars"] or 0) > total_cars)
        rank = higher + 1
        percentile = round((1 - higher / rank_total) * 100)
    else:
        rank = None
        percentile = None

    # --- Submission streak (consecutive months ending at the latest entry) ---
    months_set = {(r["year"], r["month"]) for r in monthly}
    streak = 0
    if months_set:
        y, m = max(months_set)
        streak = 1
        while True:
            pm = 12 if m == 1 else m - 1
            py = y - 1 if m == 1 else y
            if (py, pm) in months_set:
                streak += 1
                y, m = py, pm
            else:
                break

    # --- Pace vs personal average + saved-month next-tier nudge ---
    cur_cars = current_month["cars"]
    pace_pct = round((cur_cars / avg_cars - 1) * 100) if avg_cars else None
    current_next_tier = (
        compute_payout([{"car_model": None, "cars_sold": cur_cars}]).get("next_tier")
        if cur_cars > 0
        else None
    )

    return {
        "summary": {
            "total_cars": total_cars,
            "total_payout": _money(total_payout),
            "submissions": submission_count,
            "avg_cars_per_submission": avg_cars,
            "best_month_label": best_month["label"] if best_month else "",
            "best_month_payout": _money(best_month["total_payout"])
            if best_month
            else "0.00",
            "rank": rank,
            "rank_total": rank_total,
            "percentile": percentile,
            "streak": streak,
            "pace_pct": pace_pct,
            "ytd_cars": ytd_cars,
            "ytd_payout": _money(ytd_payout),
            "ytd_year": current.year,
            **trend,
        },
        "current_month": {
            **current_month,
            "total_payout": _money(current_month["total_payout"]),
            "next_tier": current_next_tier,
        },
        "monthly_trend": [
            {**row, "total_payout": _money(row["total_payout"])}
            for row in sorted(monthly, key=lambda r: (r["year"], r["month"]))[-6:]
        ],
        "model_mix": model_mix,
        "slab_distribution": [
            {**row, "total_payout": _money(row["total_payout"])}
            for row in sorted(
                slabs.values(),
                key=lambda r: (r["cars"], r["total_payout"]),
                reverse=True,
            )
        ],
        "recent_entries": recent_entries,
    }
