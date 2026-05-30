"""Glue between the DB and the pure slab engine.

Keeps views thin and gives the calculate endpoint and the persisted-entry
views a single shared code path for the payout math.
"""
from decimal import Decimal

from incentives.engine import calculate_incentive, to_slabs
from incentives.models import IncentiveSlab
from inventory.models import CarModel


def compute_payout(lines):
    """``lines`` is an iterable of ``{"car_model": id, "cars_sold": int}``.

    Returns the calculation-result dict (whole-slab model) including a per-model
    breakdown. Uses the current slab configuration as the single source of truth.
    """
    slabs = to_slabs(IncentiveSlab.objects.all())
    total_cars = sum(int(line["cars_sold"]) for line in lines)

    result = calculate_incentive(total_cars, slabs)
    rate = result.slab.rate_per_car if result.slab else Decimal("0")

    # Resolve car names for a friendly breakdown.
    ids = [line["car_model"] for line in lines if line.get("car_model")]
    names = dict(CarModel.objects.filter(id__in=ids).values_list("id", "model_name"))

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

    return result.as_dict(breakdown=breakdown)
