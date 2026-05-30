from django.urls import path

from .views import (
    AdminAnalyticsView,
    CalculateView,
    OfficerAnalyticsView,
    SalesEntryDetailView,
    SalesEntryListCreateView,
)

urlpatterns = [
    path("analytics/admin/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("analytics/officer/", OfficerAnalyticsView.as_view(), name="officer-analytics"),
    path("sales/", SalesEntryListCreateView.as_view(), name="sales-list"),
    path(
        "sales/<int:month>/<int:year>/",
        SalesEntryDetailView.as_view(),
        name="sales-detail",
    ),
    path("calculate/", CalculateView.as_view(), name="calculate"),
]
