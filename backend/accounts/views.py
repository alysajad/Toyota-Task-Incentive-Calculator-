from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from core.cache import (
    REFERENCE_TIMEOUT,
    SCOPE_ACCOUNTS,
    cache_get_or_set,
    invalidate_accounts_cache_on_commit,
    make_cache_key,
)
from core.permissions import IsAdmin

from .models import DemoCredential, Role
from .serializers import (
    ApprovalAwareTokenSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """Public sales-officer signup → creates a PENDING account."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "detail": "Registration received. Your account is pending admin "
                "approval — you'll be able to log in once an administrator "
                "approves it.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """JWT login — issues tokens only to approved accounts."""

    serializer_class = ApprovalAwareTokenSerializer
    permission_classes = [AllowAny]


class DemoCredentialsView(APIView):
    """Returns DB-backed demo credentials only when the user can log in."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        if not settings.DEMO_CREDENTIALS_ENABLED:
            return Response({"credentials": []})

        credentials = []
        queryset = DemoCredential.objects.select_related("user").filter(is_active=True)

        for credential in queryset:
            user = credential.user
            if not user.is_active or not user.is_approved:
                continue

            authenticated = authenticate(
                request=request,
                username=user.email,
                password=credential.display_password,
            )
            if not authenticated or authenticated.pk != user.pk:
                continue

            credentials.append(
                {
                    "label": credential.label,
                    "email": user.email,
                    "password": credential.display_password,
                    "role": user.role,
                    "role_label": user.get_role_display(),
                    "status": user.status,
                    "employee_code": user.employee_code,
                    "name": user.get_full_name() or user.email,
                }
            )

        return Response({"credentials": credentials})


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class OfficerViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin oversight of sales officers + approve/reject actions."""

    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = User.objects.filter(role=Role.SALES_OFFICER)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs.order_by("-date_joined")

    def list(self, request, *args, **kwargs):
        key = make_cache_key(
            "accounts.officers.list",
            request.get_full_path(),
            scopes=[SCOPE_ACCOUNTS],
        )

        def build():
            return super(OfficerViewSet, self).list(request, *args, **kwargs).data

        return Response(cache_get_or_set(key, build, timeout=REFERENCE_TIMEOUT))

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        officer = self.get_object()
        officer.approve()
        invalidate_accounts_cache_on_commit()
        return Response(UserSerializer(officer).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        officer = self.get_object()
        officer.reject()
        invalidate_accounts_cache_on_commit()
        return Response(UserSerializer(officer).data)
