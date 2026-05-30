from rest_framework.routers import DefaultRouter

from .views import CarModelViewSet

router = DefaultRouter()
router.register(r"cars", CarModelViewSet, basename="car")

urlpatterns = router.urls
