from rest_framework import viewsets
from rest_framework.response import Response

from core.cache import (
    REFERENCE_TIMEOUT,
    SCOPE_REFERENCE,
    cache_get_or_set,
    invalidate_setup_cache_on_commit,
    make_cache_key,
)
from core.permissions import IsAdminOrReadOnly

from .models import CarModel
from .serializers import CarModelSerializer


class CarModelViewSet(viewsets.ModelViewSet):
    """Car inventory CRUD.

    Any authenticated user may read (officers need the catalogue to log sales);
    only admins may create / update / delete.
    """

    queryset = CarModel.objects.all()
    serializer_class = CarModelSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        active = self.request.query_params.get("active")
        if active in {"1", "true", "True"}:
            qs = qs.filter(is_active=True)
        return qs

    def list(self, request, *args, **kwargs):
        key = make_cache_key(
            "inventory.cars.list",
            request.get_full_path(),
            scopes=[SCOPE_REFERENCE],
        )

        def build():
            return super(CarModelViewSet, self).list(request, *args, **kwargs).data

        return Response(cache_get_or_set(key, build, timeout=REFERENCE_TIMEOUT))

    def perform_create(self, serializer):
        serializer.save()
        invalidate_setup_cache_on_commit()

    def perform_update(self, serializer):
        serializer.save()
        invalidate_setup_cache_on_commit()

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_setup_cache_on_commit()
