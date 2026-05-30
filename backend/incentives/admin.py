from django.contrib import admin

from .models import IncentiveSlab


@admin.register(IncentiveSlab)
class IncentiveSlabAdmin(admin.ModelAdmin):
    list_display = ("min_cars", "max_cars", "rate_per_car")
    ordering = ("min_cars",)
