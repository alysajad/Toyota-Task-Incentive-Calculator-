from rest_framework import serializers

from .models import CarModel


class CarModelSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = CarModel
        fields = [
            "id",
            "model_name",
            "base_suffix",
            "variant",
            "is_active",
            "display_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "display_name"]

    def get_display_name(self, obj) -> str:
        return str(obj)

    def validate_model_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Model name is required.")
        return value
