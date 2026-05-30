from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import AccountStatus, Role

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Public-safe representation of a user."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "employee_code",
            "role",
            "status",
            "date_joined",
        ]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name", "employee_code"]

    def create(self, validated_data):
        # Always created as a PENDING sales officer — role/status are never
        # client-controllable. Admins are seeded server-side only.
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            employee_code=validated_data.get("employee_code", ""),
            role=Role.SALES_OFFICER,
            status=AccountStatus.PENDING,
        )


class ApprovalAwareTokenSerializer(TokenObtainPairSerializer):
    """Issues JWTs but blocks non-approved sales officers with a clear message."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["status"] = user.status
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        if user.is_sales_officer:
            if user.status == AccountStatus.PENDING:
                raise PermissionDenied(
                    "Your account is pending admin approval. "
                    "Please wait for an administrator to approve it."
                )
            if user.status == AccountStatus.REJECTED:
                raise PermissionDenied(
                    "Your account registration was rejected. "
                    "Contact an administrator for assistance."
                )

        data["user"] = UserSerializer(user).data
        return data
