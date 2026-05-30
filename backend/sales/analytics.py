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
            officers[officer.id] = {
                "id": officer.id,
                "name": _full_name(officer),
                "email": officer.email,
                "employee_code": officer.employee_code,
                "cars": 0,
                "submissions": 0,
                "total_payout": Decimal("0"),
            }
        officers[officer.id]["cars"] += entry_cars
        officers[officer.id]["submissions"] += 1
        officers[officer.id]["total_payout"] += entry_payout

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

    current = date.today()
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

    return {
        "summary": {
            "total_cars": total_cars,
            "total_payout": _money(total_payout),
            "submissions": submission_count,
            "avg_cars_per_submission": round(total_cars / submission_count, 1)
            if submission_count
            else 0,
            "active_models": active_models,
            "retired_models": max(total_models - active_models, 0),
            "approved_officers": status_counts[AccountStatus.APPROVED],
            "pending_officers": status_counts[AccountStatus.PENDING],
        },
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

    return {
        "summary": {
            "total_cars": total_cars,
            "total_payout": _money(total_payout),
            "submissions": submission_count,
            "avg_cars_per_submission": round(total_cars / submission_count, 1)
            if submission_count
            else 0,
            "best_month_label": best_month["label"] if best_month else "",
            "best_month_payout": _money(best_month["total_payout"])
            if best_month
            else "0.00",
        },
        "current_month": {
            **current_month,
            "total_payout": _money(current_month["total_payout"]),
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
