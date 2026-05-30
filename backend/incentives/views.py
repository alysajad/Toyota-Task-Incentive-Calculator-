from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

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
        return Response(
            IncentiveSlabSerializer(slabs, many=True).data,
            status=status.HTTP_200_OK,
        )
