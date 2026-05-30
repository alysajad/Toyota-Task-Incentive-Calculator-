from django.db import models


class IncentiveSlab(models.Model):
    """A single incentive tier.

    ``max_cars = NULL`` marks the open-ended top tier ("N and above").
    Boundaries are inclusive on both ends. The set of slabs is validated to be
    contiguous (no gaps) and non-overlapping at write time, so the calculation
    engine can never hit an undefined state.
    """

    min_cars = models.PositiveIntegerField(help_text="Inclusive lower bound.")
    max_cars = models.PositiveIntegerField(
        null=True, blank=True, help_text="Inclusive upper bound; NULL = open-ended."
    )
    rate_per_car = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["min_cars"]

    def __str__(self):
        upper = self.max_cars if self.max_cars is not None else "∞"
        return f"{self.min_cars}–{upper} @ {self.rate_per_car}/car"

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
