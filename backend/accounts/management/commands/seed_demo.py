"""
One-command demo seeding so graders open the live URL to a populated app.

    python manage.py seed_demo           # create/refresh demo data
    python manage.py seed_demo --clear   # remove all demo data

Creates: 1 admin, 2 approved officers + 1 pending, ~5 Toyota-style cars,
the 3 default slabs, and a pre-filled month for one officer.
"""
import random
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import AccountStatus, Role
from incentives.models import IncentiveSlab
from inventory.models import CarModel
from sales.models import MonthlySalesEntry, SalesLine

User = get_user_model()

CARS = [
    {"model_name": "Toyota Glanza", "base_suffix": "GLZ", "variant": "V CVT"},
    {"model_name": "Toyota Urban Cruiser", "base_suffix": "URC", "variant": "Hyryder G"},
    {"model_name": "Toyota Innova Crysta", "base_suffix": "INV", "variant": "ZX AT"},
    {"model_name": "Toyota Fortuner", "base_suffix": "FRT", "variant": "Legender 4x4"},
    {"model_name": "Toyota Camry", "base_suffix": "CAM", "variant": "Hybrid"},
]

SLABS = [
    {"min_cars": 1, "max_cars": 3, "rate_per_car": Decimal("1000")},
    {"min_cars": 4, "max_cars": 7, "rate_per_car": Decimal("2000")},
    {"min_cars": 8, "max_cars": None, "rate_per_car": Decimal("3500")},
]

OFFICERS = [
    {"email": "ravi.officer@nippon.test", "first_name": "Ravi", "last_name": "Kumar",
     "employee_code": "SO-101", "status": AccountStatus.APPROVED},
    {"email": "meera.officer@nippon.test", "first_name": "Meera", "last_name": "Nair",
     "employee_code": "SO-102", "status": AccountStatus.APPROVED},
    {"email": "pending.officer@nippon.test", "first_name": "Arjun", "last_name": "Das",
     "employee_code": "SO-103", "status": AccountStatus.PENDING},
]

class Command(BaseCommand):
    help = "Seed demo data for the incentive calculator."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear", action="store_true", help="Delete all demo data and exit."
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["clear"]:
            self._clear()
            self.stdout.write(self.style.WARNING("Demo data cleared."))
            return

        admin = self._seed_admin()
        self._seed_cars()
        self._seed_slabs()
        officers = self._seed_officers()
        demo_officer = self._resolve_demo_officer(officers)
        self._seed_history(officers)

        self.stdout.write(self.style.SUCCESS("\nDemo data seeded successfully.\n"))
        self.stdout.write("UI demo credentials:")
        self.stdout.write(
            f"  Admin    → {admin.email} / {settings.DEMO_ADMIN_PASSWORD}"
        )
        self.stdout.write(
            f"  Officer  → {demo_officer.email} / {settings.DEMO_OFFICER_PASSWORD}"
        )

    # --- steps ------------------------------------------------------------
    def _clear(self):
        SalesLine.objects.all().delete()
        MonthlySalesEntry.objects.all().delete()
        IncentiveSlab.objects.all().delete()
        CarModel.objects.all().delete()
        User.objects.filter(email__endswith="@nippon.test").delete()

    def _seed_admin(self):
        admin, created = User.objects.get_or_create(
            email=settings.DEMO_ADMIN_EMAIL,
            defaults={
                "username": settings.DEMO_ADMIN_EMAIL,
                "first_name": "Nippon",
                "last_name": "Admin",
                "role": Role.ADMIN,
                "status": AccountStatus.APPROVED,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        # Always (re)set the documented password so the demo login is reliable.
        admin.set_password(settings.DEMO_ADMIN_PASSWORD)
        admin.role = Role.ADMIN
        admin.status = AccountStatus.APPROVED
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()
        self.stdout.write(f"  admin: {'created' if created else 'updated'}")
        return admin

    def _seed_cars(self):
        for car in CARS:
            CarModel.objects.update_or_create(
                model_name=car["model_name"],
                variant=car["variant"],
                defaults={"base_suffix": car["base_suffix"], "is_active": True},
            )
        self.stdout.write(f"  cars: {CarModel.objects.count()} total")

    def _seed_slabs(self):
        IncentiveSlab.objects.all().delete()
        IncentiveSlab.objects.bulk_create(
            [IncentiveSlab(**s) for s in SLABS]
        )
        self.stdout.write(f"  slabs: {IncentiveSlab.objects.count()} total")

    def _seed_officers(self):
        created = []
        for o in OFFICERS:
            user, _ = User.objects.get_or_create(
                email=o["email"],
                defaults={
                    "username": o["email"],
                    "first_name": o["first_name"],
                    "last_name": o["last_name"],
                    "employee_code": o["employee_code"],
                    "role": Role.SALES_OFFICER,
                    "status": o["status"],
                },
            )
            user.set_password(settings.DEMO_OFFICER_PASSWORD)
            user.first_name = o["first_name"]
            user.last_name = o["last_name"]
            user.employee_code = o["employee_code"]
            user.role = Role.SALES_OFFICER
            user.status = o["status"]
            user.username = user.email
            user.save()
            created.append(user)
        self.stdout.write(f"  officers: {len(created)} (2 approved, 1 pending)")
        return created

    def _resolve_demo_officer(self, officers):
        """Pick the officer whose login we document for evaluators."""
        return next(
            (
                officer
                for officer in officers
                if officer.email == settings.DEMO_OFFICER_EMAIL
                and officer.status == AccountStatus.APPROVED
            ),
            officers[0],
        )

    @staticmethod
    def _split(total, parts, rng):
        """Split ``total`` cars into ``parts`` non-negative chunks (sums to total)."""
        if parts <= 1:
            return [total]
        cuts = sorted(rng.randint(0, total) for _ in range(parts - 1))
        out, prev = [], 0
        for c in cuts:
            out.append(c - prev)
            prev = c
        out.append(total - prev)
        return out

    def _seed_history(self, officers):
        """Seed ~9 months of varied sales for approved officers so the dashboards
        have a rich trend, slab distribution, and month-over-month comparison.
        Totals are chosen to land across all three default tiers."""
        cars = list(CarModel.objects.filter(is_active=True))
        approved = [o for o in officers if o.status == AccountStatus.APPROVED]
        if not cars or not approved:
            return

        rng = random.Random(42)  # deterministic so reseeding is stable
        # Spread of monthly totals hitting 1–3, 4–7 and 8+ tiers.
        tier_totals = [2, 3, 5, 6, 7, 9, 11, 4, 8, 12, 1, 10]
        months_back = 8
        today = date.today()
        entry_count = 0

        for officer in approved:
            for i in range(months_back, -1, -1):  # oldest → current month (i=0)
                m, y = today.month - i, today.year
                while m <= 0:
                    m += 12
                    y -= 1
                entry, _ = MonthlySalesEntry.objects.get_or_create(
                    sales_officer=officer, month=m, year=y
                )
                entry.lines.all().delete()
                total = rng.choice(tier_totals)
                picks = rng.sample(cars, min(len(cars), rng.randint(2, 4)))
                volumes = self._split(total, len(picks), rng)
                SalesLine.objects.bulk_create(
                    [
                        SalesLine(entry=entry, car_model=car, cars_sold=v)
                        for car, v in zip(picks, volumes)
                        if v > 0
                    ]
                )
                entry_count += 1

        self.stdout.write(
            f"  history: {entry_count} monthly entries across "
            f"{len(approved)} officer(s), {months_back + 1} months each"
        )
