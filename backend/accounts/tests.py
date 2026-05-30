from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from .models import AccountStatus, DemoCredential, Role


class RegisterValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def payload(self, **overrides):
        data = {
            "email": "new.officer@nippon.test",
            "password": "Officer@12345",
            "first_name": "New",
            "last_name": "Officer",
            "employee_code": "SO-301",
        }
        data.update(overrides)
        return data

    def test_registration_requires_nippon_email_domain(self):
        res = self.client.post(
            "/api/auth/register/",
            self.payload(email="new.officer@gmail.com"),
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("email", res.data["errors"])

    def test_registration_requires_so_serial_employee_code(self):
        res = self.client.post(
            "/api/auth/register/",
            self.payload(employee_code="admin@nippon.test"),
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("employee_code", res.data["errors"])

    def test_registration_rejects_duplicate_employee_code(self):
        User = get_user_model()
        User.objects.create_user(
            email="existing.officer@nippon.test",
            password="Officer@12345",
            role=Role.SALES_OFFICER,
            status=AccountStatus.APPROVED,
            employee_code="SO-301",
        )

        res = self.client.post("/api/auth/register/", self.payload(), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("employee_code", res.data["errors"])

    def test_valid_registration_normalizes_employee_code(self):
        res = self.client.post(
            "/api/auth/register/",
            self.payload(employee_code="so-302", email="NEW.OFFICER@NIPPON.TEST"),
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["user"]["email"], "new.officer@nippon.test")
        self.assertEqual(res.data["user"]["employee_code"], "SO-302")


class SalesOfficerDatabaseConstraintTests(TransactionTestCase):
    def test_database_rejects_sales_officer_email_outside_nippon_domain(self):
        User = get_user_model()
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                email="outside@gmail.com",
                password="Officer@12345",
                role=Role.SALES_OFFICER,
                status=AccountStatus.APPROVED,
                employee_code="SO-401",
            )

    def test_database_rejects_invalid_employee_code_format(self):
        User = get_user_model()
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                email="bad.code@nippon.test",
                password="Officer@12345",
                role=Role.SALES_OFFICER,
                status=AccountStatus.APPROVED,
                employee_code="BAD-401",
            )


class DemoCredentialsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(DEMO_CREDENTIALS_ENABLED=True)
    def test_demo_credentials_are_fetched_from_db_and_auth_validated(self):
        User = get_user_model()
        admin = User.objects.create_superuser(
            email="admin@nippon.test",
            password="Admin@12345",
            first_name="Nippon",
            last_name="Admin",
        )
        officer = User.objects.create_user(
            email="ravi.officer@nippon.test",
            password="Officer@12345",
            first_name="Ravi",
            last_name="Kumar",
            role=Role.SALES_OFFICER,
            status=AccountStatus.APPROVED,
            employee_code="SO-101",
        )
        DemoCredential.objects.create(
            user=admin,
            label="Administrator",
            display_password="Admin@12345",
            sort_order=1,
        )
        DemoCredential.objects.create(
            user=officer,
            label="Sales Officer",
            display_password="Officer@12345",
            sort_order=2,
        )

        res = self.client.get("/api/auth/demo-credentials/")

        self.assertEqual(res.status_code, 200)
        credentials = {item["email"]: item for item in res.data["credentials"]}
        self.assertEqual(credentials["admin@nippon.test"]["password"], "Admin@12345")
        self.assertEqual(
            credentials["ravi.officer@nippon.test"]["employee_code"],
            "SO-101",
        )

    @override_settings(DEMO_CREDENTIALS_ENABLED=True)
    def test_demo_credentials_hide_passwords_that_do_not_match_user_hash(self):
        User = get_user_model()
        officer = User.objects.create_user(
            email="mismatch.officer@nippon.test",
            password="Actual@12345",
            role=Role.SALES_OFFICER,
            status=AccountStatus.APPROVED,
            employee_code="SO-501",
        )
        DemoCredential.objects.create(
            user=officer,
            label="Sales Officer",
            display_password="Wrong@12345",
        )

        res = self.client.get("/api/auth/demo-credentials/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["credentials"], [])

    @override_settings(DEMO_CREDENTIALS_ENABLED=False)
    def test_demo_credentials_can_be_disabled(self):
        res = self.client.get("/api/auth/demo-credentials/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["credentials"], [])
