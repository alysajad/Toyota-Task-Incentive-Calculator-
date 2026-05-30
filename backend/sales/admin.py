from django.contrib import admin

from .models import MonthlySalesEntry, SalesLine


class SalesLineInline(admin.TabularInline):
    model = SalesLine
    extra = 0


@admin.register(MonthlySalesEntry)
class MonthlySalesEntryAdmin(admin.ModelAdmin):
    list_display = ("sales_officer", "month", "year", "total_cars")
    list_filter = ("year", "month")
    search_fields = ("sales_officer__email",)
    inlines = [SalesLineInline]
