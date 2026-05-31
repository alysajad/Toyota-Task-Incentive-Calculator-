import datetime

from django.db import transaction
from rest_framework import serializers

from core.cache import invalidate_sales_cache_on_commit
from inventory.models import CarModel

from .models import MonthlySalesEntry, SalesLine
from .services import compute_payout


class SalesLineSerializer(serializers.ModelSerializer):
    car_name = serializers.CharField(source="car_model.__str__", read_only=True)

    class Meta:
        model = SalesLine
        fields = ["id", "car_model", "car_name", "cars_sold", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_cars_sold(self, value):
        if value < 0:
            raise serializers.ValidationError("Cars sold cannot be negative.")
        return value


class MonthlySalesEntrySerializer(serializers.ModelSerializer):
    lines = SalesLineSerializer(many=True)
    calculation = serializers.SerializerMethodField()

    class Meta:
        model = MonthlySalesEntry
        fields = [
            "id",
            "month",
            "year",
            "lines",
            "calculation",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_calculation(self, obj):
        lines = [
            {"car_model": l.car_model_id, "cars_sold": l.cars_sold}
            for l in obj.lines.all()
        ]
        return compute_payout(lines)

    def validate_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError("Month must be between 1 and 12.")
        return value

    def validate_year(self, value):
        current = datetime.date.today().year
        if not (2000 <= value <= current + 1):
            raise serializers.ValidationError(
                f"Year must be between 2000 and {current + 1}."
            )
        return value

    def validate(self, attrs):
        # Officers may only log/edit the current month — past months are locked
        # so analytics stay trustworthy (seed data is created server-side).
        today = datetime.date.today()
        month = attrs.get("month", getattr(self.instance, "month", None))
        year = attrs.get("year", getattr(self.instance, "year", None))
        if (month, year) != (today.month, today.year):
            raise serializers.ValidationError(
                "Sales can only be logged for the current month "
                f"({today.strftime('%B %Y')})."
            )

        lines = attrs.get("lines", [])
        seen = set()
        for line in lines:
            car = line["car_model"]
            if car.id in seen:
                raise serializers.ValidationError(
                    {"lines": [f"Duplicate line for car '{car}'."]}
                )
            seen.add(car.id)
        return attrs

    def _sync_lines(self, entry, lines_data):
        entry.lines.all().delete()
        SalesLine.objects.bulk_create(
            [
                SalesLine(
                    entry=entry,
                    car_model=line["car_model"],
                    cars_sold=line["cars_sold"],
                )
                for line in lines_data
            ]
        )

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        officer = self.context["request"].user
        month, year = validated_data["month"], validated_data["year"]

        # Upsert: one entry per officer/month/year.
        entry, _ = MonthlySalesEntry.objects.get_or_create(
            sales_officer=officer, month=month, year=year
        )
        self._sync_lines(entry, lines_data)
        invalidate_sales_cache_on_commit(officer.id)
        return entry

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        instance.month = validated_data.get("month", instance.month)
        instance.year = validated_data.get("year", instance.year)
        instance.save()
        if lines_data is not None:
            self._sync_lines(instance, lines_data)
        invalidate_sales_cache_on_commit(instance.sales_officer_id)
        return instance


class CalculateInputLineSerializer(serializers.Serializer):
    car_model = serializers.PrimaryKeyRelatedField(
        queryset=CarModel.objects.all(), required=False, allow_null=True
    )
    cars_sold = serializers.IntegerField(min_value=0)


class CalculateRequestSerializer(serializers.Serializer):
    """Stateless calc input for the real-time tracker."""

    lines = CalculateInputLineSerializer(many=True)
    month = serializers.IntegerField(min_value=1, max_value=12, required=False)
    year = serializers.IntegerField(min_value=2000, max_value=2100, required=False)

    def to_payout(self):
        lines = [
            {
                "car_model": line["car_model"].id if line.get("car_model") else None,
                "cars_sold": line["cars_sold"],
            }
            for line in self.validated_data["lines"]
        ]
        return compute_payout(lines)
