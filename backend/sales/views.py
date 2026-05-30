from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from core.cache import (
    ANALYTICS_TIMEOUT,
    SCOPE_ACCOUNTS,
    SCOPE_SALES,
    SCOPE_SETUP,
    cache_get_or_set,
    make_cache_key,
    officer_sales_scope,
)
from core.permissions import IsAdmin, IsApprovedSalesOfficer

from .analytics import build_admin_analytics, build_officer_analytics
from .exports import build_sales_csv
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
        key = make_cache_key(
            "analytics.admin",
            scopes=[SCOPE_SALES, SCOPE_SETUP, SCOPE_ACCOUNTS],
        )
        data = cache_get_or_set(key, build_admin_analytics, timeout=ANALYTICS_TIMEOUT)
        return Response(data)


class OfficerAnalyticsView(APIView):
    """Read-only analytics for the signed-in approved sales officer."""

    permission_classes = [IsApprovedSalesOfficer]

    def get(self, request):
        key = make_cache_key(
            "analytics.officer",
            request.user.id,
            scopes=[officer_sales_scope(request.user.id), SCOPE_SETUP],
        )
        data = cache_get_or_set(
            key,
            lambda: build_officer_analytics(request.user),
            timeout=ANALYTICS_TIMEOUT,
        )
        return Response(data)


class SalesExportView(APIView):
    """CSV download of saved sales — own data for officers, all for admins.

    Query params:
      * ``detail=summary|lines`` — per-month rows (default) or per-model rows.
      * ``officer=<id>`` — admin-only narrowing to a single officer.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Same gate as the read endpoints: admins, or approved officers only.
        if not (user.is_admin or (user.is_sales_officer and user.is_approved)):
            self.permission_denied(
                request,
                message="Your sales-officer account must be approved to export data.",
            )
        officer_id = request.query_params.get("officer") if user.is_admin else None
        detail = request.query_params.get("detail", "summary")
        return build_sales_csv(user, officer_id=officer_id, detail=detail)
