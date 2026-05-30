"""Root URL configuration."""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import OfficerViewSet

router = DefaultRouter()
router.register(r"officers", OfficerViewSet, basename="officer")


def health(_request):
    return JsonResponse({"status": "ok", "service": "incentive-calculator-api"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("inventory.urls")),
    path("api/", include("incentives.urls")),
    path("api/", include("sales.urls")),
    path("api/", include(router.urls)),
]
