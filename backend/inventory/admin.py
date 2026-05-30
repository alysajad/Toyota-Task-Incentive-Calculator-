from django.contrib import admin

from .models import CarModel


@admin.register(CarModel)
class CarModelAdmin(admin.ModelAdmin):
    list_display = ("model_name", "variant", "base_suffix", "is_active")
    list_filter = ("is_active",)
    search_fields = ("model_name", "variant", "base_suffix")
