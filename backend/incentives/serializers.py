from rest_framework import serializers

from .engine import Slab, to_slabs, validate_slab_set
from .models import IncentiveSlab


class IncentiveSlabSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    class Meta:
        model = IncentiveSlab
        fields = ["id", "min_cars", "max_cars", "rate_per_car", "label"]
        read_only_fields = ["id", "label"]

    def get_label(self, obj) -> str:
        return obj.label

    def validate_rate_per_car(self, value):
        if value < 0:
            raise serializers.ValidationError("Rate per car cannot be negative.")
        return value

    def _resulting_set(self, validated):
        """The full slab set as it would look *after* this write — used to
        validate contiguity/overlap across all slabs, not just this one."""
        others = IncentiveSlab.objects.all()
        if self.instance is not None:
            others = others.exclude(pk=self.instance.pk)

        slabs = to_slabs(others)
        slabs.append(
            Slab(
                min_cars=validated["min_cars"],
                max_cars=validated.get("max_cars"),
                rate_per_car=validated["rate_per_car"],
            )
        )
        return slabs

    def validate(self, attrs):
        # Merge with existing instance values for PATCH.
        merged = {
            "min_cars": attrs.get(
                "min_cars", getattr(self.instance, "min_cars", None)
            ),
            "max_cars": attrs.get(
                "max_cars",
                getattr(self.instance, "max_cars", None) if self.instance else None,
            ),
            "rate_per_car": attrs.get(
                "rate_per_car", getattr(self.instance, "rate_per_car", None)
            ),
        }
        errors = validate_slab_set(self._resulting_set(merged))
        if errors:
            raise serializers.ValidationError({"slabs": errors})
        return attrs


class SlabBulkReplaceSerializer(serializers.Serializer):
    """Atomically replace the entire slab set after validating it as a whole."""

    slabs = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate(self, attrs):
        try:
            slabs = to_slabs(attrs["slabs"])
        except (TypeError, ValueError, KeyError):
            raise serializers.ValidationError(
                {"slabs": ["Each slab needs numeric min_cars, max_cars, rate_per_car."]}
            )
        errors = validate_slab_set(slabs)
        if errors:
            raise serializers.ValidationError({"slabs": errors})
        attrs["clean_slabs"] = slabs
        return attrs

    def save(self):
        from django.db import transaction

        clean = self.validated_data["clean_slabs"]
        with transaction.atomic():
            IncentiveSlab.objects.all().delete()
            IncentiveSlab.objects.bulk_create(
                [
                    IncentiveSlab(
                        min_cars=s.min_cars,
                        max_cars=s.max_cars,
                        rate_per_car=s.rate_per_car,
                    )
                    for s in clean
                ]
            )
        return IncentiveSlab.objects.all()


class SlabValidateSerializer(serializers.Serializer):
    """Dry-run validator for the slab editor's live overlap/gap warnings."""

    slabs = serializers.ListField(child=serializers.DictField(), allow_empty=True)

    def validate(self, attrs):
        raw = attrs["slabs"]
        try:
            slabs = to_slabs(raw)
        except (TypeError, ValueError, KeyError):
            raise serializers.ValidationError(
                {"slabs": ["Each slab needs numeric min_cars, max_cars, rate_per_car."]}
            )
        attrs["errors"] = validate_slab_set(slabs)
        return attrs
