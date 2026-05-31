from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from .models import AccountStatus, Role


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
