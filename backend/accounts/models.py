import re

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


SALES_OFFICER_EMAIL_DOMAIN = "@nippon.test"
EMPLOYEE_CODE_PATTERN = r"^SO-[0-9]+$"
EMPLOYEE_CODE_MESSAGE = "Employee code must use SO-<serial number>, for example SO-104."


class Role(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    SALES_OFFICER = "SALES_OFFICER", "Sales Officer"


class AccountStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class UserManager(BaseUserManager):
    """Email-as-username manager."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email)
        # Keep username populated (AbstractUser requires it) but key off email.
        extra.setdefault("username", email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", Role.SALES_OFFICER)
        extra.setdefault("status", AccountStatus.PENDING)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(
            is_staff=True,
            is_superuser=True,
            role=Role.ADMIN,
            status=AccountStatus.APPROVED,
        )
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Custom user keyed by email, carrying role + approval status."""

    email = models.EmailField("email address", unique=True)
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.SALES_OFFICER
    )
    status = models.CharField(
        max_length=10, choices=AccountStatus.choices, default=AccountStatus.PENDING
    )
    employee_code = models.CharField(max_length=50, blank=True, default="")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # email + password only

    objects = UserManager()

    class Meta:
        ordering = ["-date_joined"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee_code"],
                condition=~Q(employee_code=""),
                name="unique_nonblank_employee_code",
            ),
            models.CheckConstraint(
                condition=Q(employee_code="") | Q(employee_code__regex=EMPLOYEE_CODE_PATTERN),
                name="employee_code_format_so_serial",
            ),
            models.CheckConstraint(
                condition=~Q(role=Role.SALES_OFFICER)
                | Q(email__iendswith=SALES_OFFICER_EMAIL_DOMAIN),
                name="sales_officer_email_nippon_domain",
            ),
            models.CheckConstraint(
                condition=~Q(role=Role.SALES_OFFICER)
                | Q(employee_code__regex=EMPLOYEE_CODE_PATTERN),
                name="sales_officer_employee_code_required",
            ),
        ]

    def __str__(self):
        return f"{self.email} ({self.role})"

    def clean(self):
        super().clean()
        self.email = self.__class__.objects.normalize_email(self.email).strip().lower()
        self.employee_code = (self.employee_code or "").strip().upper()

        errors = {}
        if self.is_sales_officer:
            if not self.email.endswith(SALES_OFFICER_EMAIL_DOMAIN):
                errors["email"] = "Sales officer email must use the @nippon.test domain."
            if not re.fullmatch(EMPLOYEE_CODE_PATTERN, self.employee_code):
                errors["employee_code"] = EMPLOYEE_CODE_MESSAGE
        elif self.employee_code and not re.fullmatch(EMPLOYEE_CODE_PATTERN, self.employee_code):
            errors["employee_code"] = EMPLOYEE_CODE_MESSAGE

        if errors:
            raise ValidationError(errors)

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    @property
    def is_sales_officer(self) -> bool:
        return self.role == Role.SALES_OFFICER

    @property
    def is_approved(self) -> bool:
        return self.status == AccountStatus.APPROVED

    def approve(self):
        self.status = AccountStatus.APPROVED
        self.save(update_fields=["status"])

    def reject(self):
        self.status = AccountStatus.REJECTED
        self.save(update_fields=["status"])


class DemoCredential(models.Model):
    """Public demo login helper tied to a real, password-hashed user."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="demo_credential",
    )
    label = models.CharField(max_length=80)
    display_password = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.label} ({self.user.email})"
