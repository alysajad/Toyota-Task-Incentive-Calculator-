from django.contrib.auth import get_user_model
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import IsAdmin

from .models import Role
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

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        officer = self.get_object()
        officer.approve()
        return Response(UserSerializer(officer).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        officer = self.get_object()
        officer.reject()
        return Response(UserSerializer(officer).data)
