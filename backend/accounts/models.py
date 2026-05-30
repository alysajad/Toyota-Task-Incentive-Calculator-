from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


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

    def __str__(self):
        return f"{self.email} ({self.role})"

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
