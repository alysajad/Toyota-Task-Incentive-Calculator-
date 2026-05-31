import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from accounts.models import AccountStatus, Role
from incentives.models import IncentiveSlab
from inventory.models import CarModel

# Officers may only log the current month, so tests post to "today".
TODAY = datetime.date.today()
CURRENT_MONTH = TODAY.month
CURRENT_YEAR = TODAY.year


class ApiCacheInvalidationTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="Admin@12345",
            role=Role.ADMIN,
            status=AccountStatus.APPROVED,
        )
        self.officer = User.objects.create_user(
            email="officer@nippon.test",
            password="Officer@12345",
            role=Role.SALES_OFFICER,
            status=AccountStatus.APPROVED,
            employee_code="SO-201",
        )
        self.car = CarModel.objects.create(model_name="Innova", variant="ZX")
        self.slab = IncentiveSlab.objects.create(
            min_cars=1,
            max_cars=None,
            rate_per_car=Decimal("100.00"),
        )
        self.client = APIClient()

    def test_admin_analytics_cache_refreshes_after_sales_save(self):
        self.client.force_authenticate(self.admin)
        first = self.client.get("/api/analytics/admin/")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["summary"]["total_cars"], 0)

        self.client.force_authenticate(self.officer)
        saved = self.client.post(
            "/api/sales/",
            {
                "month": CURRENT_MONTH,
                "year": CURRENT_YEAR,
                "lines": [{"car_model": self.car.id, "cars_sold": 2}],
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 201)

        self.client.force_authenticate(self.admin)
        refreshed = self.client.get("/api/analytics/admin/")
        self.assertEqual(refreshed.status_code, 200)
        self.assertEqual(refreshed.data["summary"]["total_cars"], 2)
        self.assertEqual(refreshed.data["summary"]["total_payout"], "200.00")

    def test_officer_cannot_log_past_month(self):
        self.client.force_authenticate(self.officer)
        past = TODAY.replace(day=1) - datetime.timedelta(days=1)  # last month
        res = self.client.post(
            "/api/sales/",
            {
                "month": past.month,
                "year": past.year,
                "lines": [{"car_model": self.car.id, "cars_sold": 2}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_calculator_uses_fresh_slab_after_admin_update(self):
        self.client.force_authenticate(self.officer)
        first = self.client.post(
            "/api/calculate/",
            {"lines": [{"car_model": self.car.id, "cars_sold": 2}]},
            format="json",
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["total_payout"], "200.00")

        self.client.force_authenticate(self.admin)
        updated = self.client.patch(
            f"/api/slabs/{self.slab.id}/",
            {"rate_per_car": "300.00"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)

        self.client.force_authenticate(self.officer)
        refreshed = self.client.post(
            "/api/calculate/",
            {"lines": [{"car_model": self.car.id, "cars_sold": 2}]},
            format="json",
        )
        self.assertEqual(refreshed.status_code, 200)
        self.assertEqual(refreshed.data["total_payout"], "600.00")


class SalesExportTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="Admin@12345",
            role=Role.ADMIN,
            status=AccountStatus.APPROVED,
        )
        self.ravi = User.objects.create_user(
            email="ravi@nippon.test",
            password="Officer@12345",
            first_name="Ravi",
            role=Role.SALES_OFFICER,
            status=AccountStatus.APPROVED,
            employee_code="SO-202",
        )
        self.meera = User.objects.create_user(
            email="meera@nippon.test",
            password="Officer@12345",
            first_name="Meera",
            role=Role.SALES_OFFICER,
            status=AccountStatus.APPROVED,
            employee_code="SO-203",
        )
        self.car = CarModel.objects.create(model_name="Innova", variant="ZX")
        IncentiveSlab.objects.create(min_cars=1, max_cars=None, rate_per_car=Decimal("100.00"))
        self.client = APIClient()
        for officer, qty in ((self.ravi, 2), (self.meera, 5)):
            self.client.force_authenticate(officer)
            self.client.post(
                "/api/sales/",
                {
                    "month": CURRENT_MONTH,
                    "year": CURRENT_YEAR,
                    "lines": [{"car_model": self.car.id, "cars_sold": qty}],
                },
                format="json",
            )

    def test_officer_export_is_scoped_to_own_rows(self):
        self.client.force_authenticate(self.ravi)
        res = self.client.get("/api/export/sales/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "text/csv")
        self.assertIn("attachment;", res["Content-Disposition"])
        body = res.content.decode("utf-8-sig")
        # Ravi sees only his own data; never Meera's.
        self.assertIn("200.00", body)
        self.assertNotIn("meera@nippon.test", body)

    def test_admin_export_includes_all_officers(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/export/sales/")
        self.assertEqual(res.status_code, 200)
        body = res.content.decode("utf-8-sig")
        self.assertIn("ravi@nippon.test", body)
        self.assertIn("meera@nippon.test", body)

    def test_admin_can_export_per_model_detail(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/export/sales/?detail=lines")
        self.assertEqual(res.status_code, 200)
        body = res.content.decode("utf-8-sig")
        self.assertIn("Model", body.splitlines()[0])  # header has a Model column
        self.assertIn("Innova", body)

    def test_unauthenticated_export_is_rejected(self):
        self.client.force_authenticate(None)
        res = self.client.get("/api/export/sales/")
        self.assertEqual(res.status_code, 401)
