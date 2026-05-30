from rest_framework.routers import DefaultRouter

from .views import IncentiveSlabViewSet

router = DefaultRouter()
router.register(r"slabs", IncentiveSlabViewSet, basename="slab")

urlpatterns = router.urls
