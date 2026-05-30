"""Reusable RBAC permission classes — enforced server-side on every endpoint."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdmin(BasePermission):
    """Allow only authenticated users with the ADMIN role."""

    message = "Administrator access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin)


class IsApprovedSalesOfficer(BasePermission):
    """Allow only APPROVED sales officers."""

    message = "Your sales-officer account must be approved to access this resource."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_sales_officer
            and user.is_approved
        )


class IsAdminOrReadOnly(BasePermission):
    """Read for any authenticated user; write only for admins.

    Used for shared catalogue data (cars, slabs) that officers must read to
    drive the calculator but only admins may modify.
    """

    message = "Administrator access required to modify this resource."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.is_admin
