"""Glue between the DB and the pure slab engine.

Keeps views thin and gives the calculate endpoint and the persisted-entry
views a single shared code path for the payout math.
"""
from decimal import Decimal

from core.cache import (
    REFERENCE_TIMEOUT,
    SCOPE_SETUP,
    cache_get_or_set,
    make_cache_key,
)
from incentives.engine import calculate_incentive, next_tier, to_slabs
from incentives.models import IncentiveSlab
from inventory.models import CarModel


def _current_slabs():
    key = make_cache_key("incentives.current-slabs", scopes=[SCOPE_SETUP])
    return cache_get_or_set(
        key,
        lambda: to_slabs(IncentiveSlab.objects.all()),
        timeout=REFERENCE_TIMEOUT,
    )


def _car_model_names(ids):
    ids = sorted({int(pk) for pk in ids if pk})
    if not ids:
        return {}

    key = make_cache_key(
        "inventory.car-model-names",
        ",".join(str(pk) for pk in ids),
        scopes=[SCOPE_SETUP],
    )
    return cache_get_or_set(
        key,
        lambda: dict(CarModel.objects.filter(id__in=ids).values_list("id", "model_name")),
        timeout=REFERENCE_TIMEOUT,
    )


def compute_payout(lines):
    """``lines`` is an iterable of ``{"car_model": id, "cars_sold": int}``.

    Returns the calculation-result dict (whole-slab model) including a per-model
    breakdown. Uses the current slab configuration as the single source of truth.
    """
    lines = list(lines)
    slabs = _current_slabs()
    total_cars = sum(int(line["cars_sold"]) for line in lines)

    result = calculate_incentive(total_cars, slabs)
    rate = result.slab.rate_per_car if result.slab else Decimal("0")

    # Resolve car names for a friendly breakdown.
    ids = [line["car_model"] for line in lines if line.get("car_model")]
    names = _car_model_names(ids)

    breakdown = []
    for line in lines:
        cars = int(line["cars_sold"])
        breakdown.append(
            {
                "car_model": line.get("car_model"),
                "car_name": names.get(line.get("car_model"), "Unknown model"),
                "cars_sold": cars,
                "line_payout": str(Decimal(cars) * rate),
            }
        )

    payload = result.as_dict(breakdown=breakdown)

    upcoming = next_tier(total_cars, slabs)
    payload["next_tier"] = (
        {
            "cars_to_next": upcoming.cars_to_next,
            "label": upcoming.next_label,
            "rate_per_car": str(upcoming.next_rate),
            "payout_at_threshold": str(upcoming.payout_at_threshold),
            "uplift": str(upcoming.uplift),
        }
        if upcoming
        else None
    )
    return payload
