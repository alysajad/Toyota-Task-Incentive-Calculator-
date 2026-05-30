"""CSV export of sales data, RBAC-scoped and shared by every role.

Officers can export their own saved months; admins can export the whole book
(optionally narrowed to one officer). Two grains are offered:

* ``summary`` — one row per saved month (officer · month · cars · tier · payout)
* ``lines``   — one row per car model within each month (per-model breakdown)

The payout/tier figures come from the same :func:`compute_payout` engine the
rest of the app uses, so an export can never disagree with the dashboards.
"""
import csv
from datetime import date

from django.http import HttpResponse

from accounts.models import Role

from .analytics import MONTH_NAMES
from .models import MonthlySalesEntry
from .services import compute_payout


def _full_name(user) -> str:
    name = f"{user.first_name} {user.last_name}".strip()
    return name or user.email


def _scoped_entries(user, officer_id=None):
    qs = (
        MonthlySalesEntry.objects.select_related("sales_officer")
        .prefetch_related("lines__car_model")
        .order_by("-year", "-month")
    )
    if user.role == Role.ADMIN:
        return qs.filter(sales_officer_id=officer_id) if officer_id else qs
    return qs.filter(sales_officer=user)


def _filename(user, detail) -> str:
    who = "all-officers" if user.role == Role.ADMIN else "my"
    stamp = date.today().isoformat()
    return f"nippon-sales-{who}-{detail}-{stamp}.csv"


def build_sales_csv(user, officer_id=None, detail="summary") -> HttpResponse:
    """Return an ``HttpResponse`` streaming a CSV download of saved sales."""
    is_admin = user.role == Role.ADMIN
    detail = "lines" if detail == "lines" else "summary"
    entries = list(_scoped_entries(user, officer_id))

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{_filename(user, detail)}"'
    # Excel reads UTF-8 cleanly with a BOM (keeps ₹ and accents intact).
    response.write("﻿")
    writer = csv.writer(response)

    officer_cols = ["Officer", "Email", "Employee Code"] if is_admin else []

    if detail == "lines":
        writer.writerow(
            officer_cols
            + ["Month", "Year", "Model", "Variant", "Cars Sold", "Rate/Car", "Line Payout"]
        )
    else:
        writer.writerow(
            officer_cols
            + ["Month", "Year", "Cars Sold", "Tier", "Rate/Car", "Total Payout"]
        )

    for entry in entries:
        officer = entry.sales_officer
        lines = [
            {"car_model": line.car_model_id, "cars_sold": line.cars_sold}
            for line in entry.lines.all()
        ]
        calc = compute_payout(lines)
        month_label = MONTH_NAMES[entry.month - 1]
        rate = calc["slab"]["rate_per_car"] if calc.get("slab") else "0"
        prefix = [_full_name(officer), officer.email, officer.employee_code] if is_admin else []

        if detail == "lines":
            line_by_id = {line.car_model_id: line for line in entry.lines.all()}
            for row in calc["breakdown"]:
                if row["cars_sold"] <= 0:
                    continue
                car = line_by_id.get(row["car_model"])
                writer.writerow(
                    prefix
                    + [
                        month_label,
                        entry.year,
                        row["car_name"],
                        car.car_model.variant if car else "",
                        row["cars_sold"],
                        rate,
                        row["line_payout"],
                    ]
                )
        else:
            tier = calc["slab"]["label"] if calc.get("slab") else "No tier"
            writer.writerow(
                prefix
                + [
                    month_label,
                    entry.year,
                    calc["total_cars"],
                    tier,
                    rate,
                    calc["total_payout"],
                ]
            )

    return response
