from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class MonthlySalesEntry(models.Model):
    sales_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sales_entries",
    )
    month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    year = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["sales_officer", "month", "year"],
                name="unique_entry_per_officer_month",
            )
        ]
        ordering = ["-year", "-month"]

    def __str__(self):
        return f"{self.sales_officer.email} — {self.month:02d}/{self.year}"

    @property
    def total_cars(self) -> int:
        return sum(line.cars_sold for line in self.lines.all())


class SalesLine(models.Model):
    entry = models.ForeignKey(
        MonthlySalesEntry, on_delete=models.CASCADE, related_name="lines"
    )
    car_model = models.ForeignKey(
        "inventory.CarModel", on_delete=models.PROTECT, related_name="sales_lines"
    )
    cars_sold = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "car_model"], name="unique_car_per_entry"
            )
        ]

    def __str__(self):
        return f"{self.car_model} × {self.cars_sold}"
