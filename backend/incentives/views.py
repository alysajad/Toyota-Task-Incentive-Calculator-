from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.cache import (
    REFERENCE_TIMEOUT,
    SCOPE_REFERENCE,
    cache_get_or_set,
    invalidate_setup_cache_on_commit,
    make_cache_key,
)
from core.permissions import IsAdmin, IsAdminOrReadOnly

from .models import IncentiveSlab
from .serializers import (
    IncentiveSlabSerializer,
    SlabBulkReplaceSerializer,
    SlabValidateSerializer,
)


class IncentiveSlabViewSet(viewsets.ModelViewSet):
    """Slab CRUD (admin write, authed read) + a dry-run validate endpoint."""

    queryset = IncentiveSlab.objects.all()
    serializer_class = IncentiveSlabSerializer
    permission_classes = [IsAdminOrReadOnly]

    def list(self, request, *args, **kwargs):
        key = make_cache_key(
            "incentives.slabs.list",
            request.get_full_path(),
            scopes=[SCOPE_REFERENCE],
        )

        def build():
            return super(IncentiveSlabViewSet, self).list(request, *args, **kwargs).data

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

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAdmin],
        url_path="validate",
    )
    def validate_set(self, request):
        """Validate a proposed slab configuration without persisting it."""
        serializer = SlabValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        errors = serializer.validated_data["errors"]
        return Response(
            {"valid": len(errors) == 0, "errors": errors},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["put"],
        permission_classes=[IsAdmin],
        url_path="bulk-replace",
    )
    def bulk_replace(self, request):
        """Replace the whole slab configuration in one atomic, validated write."""
        serializer = SlabBulkReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slabs = serializer.save()
        invalidate_setup_cache_on_commit()
        return Response(
            IncentiveSlabSerializer(slabs, many=True).data,
            status=status.HTTP_200_OK,
        )
