from rest_framework import viewsets

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
