"""
The slab engine — the single source of truth for incentive math.

Two pure functions, free of Django/DB coupling so they are trivially unit
testable and swappable:

* ``validate_slab_set``  — checks a slab configuration is contiguous,
  non-overlapping, and well-formed.
* ``calculate_incentive`` — given a car count and a slab set, returns the
  matched tier and payout.

Calculation model: **WHOLE-SLAB**. The total cars sold (summed across every
model line) selects a single slab; every car is then paid at that slab's rate.
This matches the assignment's literal wording ("8+ cars = 3500 per car").

A progressive/marginal model would only change ``calculate_incentive`` — the
rest of the system is agnostic. That isolation is intentional.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, Optional, Sequence


@dataclass(frozen=True)
class Slab:
    """A plain, framework-free slab. Mirrors the IncentiveSlab model fields."""

    min_cars: int
    max_cars: Optional[int]  # None = open-ended top tier
    rate_per_car: Decimal

    def contains(self, count: int) -> bool:
        if count < self.min_cars:
            return False
        if self.max_cars is None:
            return True
        return count <= self.max_cars

    @property
    def label(self) -> str:
        if self.max_cars is None:
            return f"{self.min_cars}+"
        if self.min_cars == self.max_cars:
            return f"{self.min_cars}"
        return f"{self.min_cars}–{self.max_cars}"


def to_slabs(rows: Iterable) -> list[Slab]:
    """Coerce model instances / dicts into framework-free ``Slab`` objects."""
    out: list[Slab] = []
    for r in rows:
        if isinstance(r, dict):
            mn, mx, rate = r.get("min_cars"), r.get("max_cars"), r.get("rate_per_car")
        else:
            mn, mx, rate = r.min_cars, r.max_cars, r.rate_per_car
        out.append(
            Slab(
                min_cars=int(mn),
                max_cars=None if mx in (None, "") else int(mx),
                rate_per_car=Decimal(str(rate)),
            )
        )
    return out


def validate_slab_set(slabs: Sequence[Slab]) -> list[str]:
    """Return a list of human-readable problems. Empty list = valid.

    Rules:
      * at least one slab,
      * every min/max is a non-negative int with max >= min (when bounded),
      * the lowest slab starts at 1 (so a single car always maps to a tier),
      * tiers are contiguous: each tier starts exactly one above the previous
        tier's max (no gaps, no overlaps),
      * at most one open-ended tier, and it must be the highest.
    """
    errors: list[str] = []
    if not slabs:
        return ["At least one incentive slab is required."]

    ordered = sorted(slabs, key=lambda s: s.min_cars)

    # Per-slab sanity.
    for s in ordered:
        if s.min_cars < 1:
            errors.append(f"Slab starting at {s.min_cars}: minimum must be at least 1.")
        if s.max_cars is not None and s.max_cars < s.min_cars:
            errors.append(
                f"Slab {s.label}: maximum ({s.max_cars}) cannot be less than "
                f"minimum ({s.min_cars})."
            )
        if s.rate_per_car < 0:
            errors.append(f"Slab {s.label}: rate per car cannot be negative.")

    # Only the last (by min) slab may be open-ended.
    open_ended = [s for s in ordered if s.max_cars is None]
    if len(open_ended) > 1:
        errors.append("Only one open-ended ('and above') slab is allowed.")
    if open_ended and open_ended[0] is not ordered[-1]:
        errors.append("The open-ended ('and above') slab must be the highest tier.")

    # Must cover from 1 upward with no gaps/overlaps.
    if ordered[0].min_cars != 1:
        errors.append(
            f"The lowest slab must start at 1 (it starts at {ordered[0].min_cars})."
        )

    for prev, nxt in zip(ordered, ordered[1:]):
        if prev.max_cars is None:
            errors.append(
                f"Slab {prev.label} is open-ended but is not the highest tier."
            )
            continue
        expected = prev.max_cars + 1
        if nxt.min_cars < expected:
            errors.append(
                f"Slabs {prev.label} and {nxt.label} overlap "
                f"(expected the next tier to start at {expected})."
            )
        elif nxt.min_cars > expected:
            errors.append(
                f"Gap between slabs {prev.label} and {nxt.label} "
                f"(expected the next tier to start at {expected})."
            )

    # De-duplicate while preserving order.
    seen, unique = set(), []
    for e in errors:
        if e not in seen:
            seen.add(e)
            unique.append(e)
    return unique


@dataclass(frozen=True)
class CalculationResult:
    total_cars: int
    slab: Optional[Slab]
    total_payout: Decimal
    matched: bool
    message: str = ""

    def as_dict(self, breakdown=None) -> dict:
        slab_data = None
        if self.slab is not None:
            slab_data = {
                "min_cars": self.slab.min_cars,
                "max_cars": self.slab.max_cars,
                "rate_per_car": str(self.slab.rate_per_car),
                "label": self.slab.label,
            }
        return {
            "total_cars": self.total_cars,
            "slab": slab_data,
            "total_payout": str(self.total_payout),
            "matched": self.matched,
            "message": self.message,
            "breakdown": breakdown or [],
        }


def calculate_incentive(total_cars: int, slabs: Sequence[Slab]) -> CalculationResult:
    """The core rule. Pure: same inputs → same output, no side effects.

    * 0 cars → payout 0, no slab, friendly message.
    * otherwise → find the slab whose inclusive [min, max] contains the count
      and pay every car at that slab's rate.
    * no matching slab → matched=False with a clear message (UI surfaces it).
    """
    if total_cars < 0:
        raise ValueError("total_cars cannot be negative.")

    if total_cars == 0:
        return CalculationResult(
            total_cars=0,
            slab=None,
            total_payout=Decimal("0"),
            matched=True,
            message="No sales logged yet for this month.",
        )

    for slab in sorted(slabs, key=lambda s: s.min_cars):
        if slab.contains(total_cars):
            payout = Decimal(total_cars) * slab.rate_per_car
            return CalculationResult(
                total_cars=total_cars,
                slab=slab,
                total_payout=payout,
                matched=True,
            )

    return CalculationResult(
        total_cars=total_cars,
        slab=None,
        total_payout=Decimal("0"),
        matched=False,
        message=(
            f"{total_cars} cars does not fall into any configured incentive slab. "
            "Ask an administrator to review the slab configuration."
        ),
    )
