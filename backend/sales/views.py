from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from core.permissions import IsAdmin, IsApprovedSalesOfficer

from .analytics import build_admin_analytics, build_officer_analytics
from .models import MonthlySalesEntry
from .serializers import (
    CalculateRequestSerializer,
    MonthlySalesEntrySerializer,
)


class _OwnSalesQuerysetMixin:
    """Officers see only their own entries; admins get read-only oversight of all."""

    def get_queryset(self):
        user = self.request.user
        qs = MonthlySalesEntry.objects.prefetch_related("lines__car_model")
        if user.role == Role.ADMIN:
            officer_id = self.request.query_params.get("officer")
            return qs.filter(sales_officer_id=officer_id) if officer_id else qs
        return qs.filter(sales_officer=user)


class SalesEntryListCreateView(_OwnSalesQuerysetMixin, generics.ListCreateAPIView):
    serializer_class = MonthlySalesEntrySerializer

    def get_permissions(self):
        # Admins may read (oversight); only approved officers may write.
        if self.request.method == "POST":
            return [IsApprovedSalesOfficer()]
        return [IsAuthenticated()]


class SalesEntryDetailView(_OwnSalesQuerysetMixin, generics.RetrieveUpdateAPIView):
    """Retrieve / update by month + year (per the API spec)."""

    serializer_class = MonthlySalesEntrySerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsApprovedSalesOfficer()]
        return [IsAuthenticated()]

    def get_object(self):
        qs = self.get_queryset()
        obj = get_object_or_404(
            qs, month=self.kwargs["month"], year=self.kwargs["year"]
        )
        self.check_object_permissions(self.request, obj)
        return obj


class CalculateView(APIView):
    """Stateless payout calculation — powers the debounced real-time tracker."""

    permission_classes = [IsApprovedSalesOfficer]

    def post(self, request):
        serializer = CalculateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.to_payout())


class AdminAnalyticsView(APIView):
    """Read-only admin analytics built from persisted sales and setup data."""

    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(build_admin_analytics())


class OfficerAnalyticsView(APIView):
    """Read-only analytics for the signed-in approved sales officer."""

    permission_classes = [IsApprovedSalesOfficer]

    def get(self, request):
        return Response(build_officer_analytics(request.user))
